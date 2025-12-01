import React, { useState, useMemo, useEffect, useRef } from "react";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  EyeOff,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import type { User as UserType, Service, WorkRole, Client, Project, ProjectType as ProjectTypeSchema } from "@shared/schema";

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
  targetDeliveryDate: string | null;
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
  targetDeliveryDate: string | null;
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

interface ProjectWithDetails {
  id: string;
  name: string;
  description: string;
  currentStatus: string;
  currentStageId: string | null;
  createdAt: string | null;
  dueDate: string | null;
  completedAt: string | null;
  projectType?: {
    id: string;
    name: string;
    service?: {
      id: string;
      name: string;
    };
  };
  client?: {
    id: string;
    name: string;
  };
}

function ActiveProjectsSection({ clientServiceId }: { clientServiceId: string }) {
  const { data: projects, isLoading } = useQuery<ProjectWithDetails[]>({
    queryKey: ['/api/client-services', clientServiceId, 'projects'],
    enabled: !!clientServiceId,
  });

  const activeProjects = useMemo(() => {
    if (!projects) return [];
    return projects.filter(p => {
      const status = (p.currentStatus || '').toLowerCase();
      return status !== 'completed' && status !== 'cancelled';
    });
  }, [projects]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (!activeProjects || activeProjects.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No active projects for this service
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-4 text-xs font-medium text-muted-foreground border-b pb-1">
        <span>Project</span>
        <span>Status</span>
        <span>Created</span>
        <span>Due Date</span>
      </div>
      {activeProjects.map((project) => (
        <div key={project.id} className="grid grid-cols-4 gap-4 text-sm py-1 hover:bg-muted/50 rounded">
          <a 
            href={`/projects/${project.id}`}
            className="text-primary hover:underline truncate"
            data-testid={`link-project-${project.id}`}
          >
            {project.description || project.name}
          </a>
          <span>
            <Badge variant="outline" className="text-xs capitalize">
              {project.currentStatus?.replace(/_/g, ' ') || 'Unknown'}
            </Badge>
          </span>
          <span className="text-muted-foreground">
            {project.createdAt ? format(new Date(project.createdAt), 'dd MMM yyyy') : '—'}
          </span>
          <span className="text-muted-foreground">
            {project.dueDate ? format(new Date(project.dueDate), 'dd MMM yyyy') : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

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
  
  // Date range filter states
  const [nextStartDateFrom, setNextStartDateFrom] = useState<string>("");
  const [nextStartDateTo, setNextStartDateTo] = useState<string>("");
  const [targetDeliveryDateFrom, setTargetDeliveryDateFrom] = useState<string>("");
  const [targetDeliveryDateTo, setTargetDeliveryDateTo] = useState<string>("");
  const [nextDueDateFrom, setNextDueDateFrom] = useState<string>("");
  const [nextDueDateTo, setNextDueDateTo] = useState<string>("");

  // Selection state for bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Column visibility toggle
  const [showRoleColumns, setShowRoleColumns] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const pageSizeOptions = [25, 50, 100, 200];

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
    step: 'processing' | 'complete' | 'error';
    currentStepIndex: number;
    total: number;
    roleChanges: number;
    projectUpdates: number;
    chronologyEntries: number;
    errorMessage?: string;
  } | null>(null);
  const [reassignConfirmOpen, setReassignConfirmOpen] = useState(false);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const stepTimersRef = useRef<NodeJS.Timeout[]>([]);
  
  // Bulk date editing state
  const [dateEditDialogOpen, setDateEditDialogOpen] = useState(false);
  const [dateEditMode, setDateEditMode] = useState<'shift' | 'set'>('shift');
  const [dateEditTarget, setDateEditTarget] = useState<'start' | 'due' | 'target' | 'both' | 'all'>('both');
  const [shiftDays, setShiftDays] = useState<number>(0);
  const [setStartDate, setSetStartDate] = useState<string>('');
  const [setDueDate, setSetDueDate] = useState<string>('');
  const [setTargetDate, setSetTargetDate] = useState<string>('');

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
  
  // Get all unique roles that appear in any client service (for column headers)
  // Uses the full unfiltered clientServices data to ensure columns remain stable
  const allRolesInData = useMemo(() => {
    const roleIds = new Set<string>();
    // Scan ALL client services (unfiltered) to collect all roles in use
    clientServices.forEach(cs => {
      cs.roleAssignments?.forEach(ra => {
        if (ra.isActive) {
          roleIds.add(ra.workRoleId);
        }
      });
    });
    // Return roles that have at least one active assignment, sorted alphabetically
    return workRoles
      .filter(r => roleIds.has(r.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clientServices, workRoles]);

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

    // Apply next start date range filter
    if (nextStartDateFrom || nextStartDateTo) {
      combined = combined.filter(assignment => {
        if (!assignment.nextStartDate) return false;
        const startDate = new Date(assignment.nextStartDate);
        if (nextStartDateFrom) {
          const fromDate = new Date(nextStartDateFrom);
          if (startDate < fromDate) return false;
        }
        if (nextStartDateTo) {
          const toDate = new Date(nextStartDateTo);
          toDate.setHours(23, 59, 59, 999); // Include the entire end day
          if (startDate > toDate) return false;
        }
        return true;
      });
    }

    // Apply target delivery date range filter
    if (targetDeliveryDateFrom || targetDeliveryDateTo) {
      combined = combined.filter(assignment => {
        if (!assignment.targetDeliveryDate) return false;
        const targetDate = new Date(assignment.targetDeliveryDate);
        if (targetDeliveryDateFrom) {
          const fromDate = new Date(targetDeliveryDateFrom);
          if (targetDate < fromDate) return false;
        }
        if (targetDeliveryDateTo) {
          const toDate = new Date(targetDeliveryDateTo);
          toDate.setHours(23, 59, 59, 999); // Include the entire end day
          if (targetDate > toDate) return false;
        }
        return true;
      });
    }

    // Apply next due date range filter
    if (nextDueDateFrom || nextDueDateTo) {
      combined = combined.filter(assignment => {
        if (!assignment.nextDueDate) return false;
        const dueDate = new Date(assignment.nextDueDate);
        if (nextDueDateFrom) {
          const fromDate = new Date(nextDueDateFrom);
          if (dueDate < fromDate) return false;
        }
        if (nextDueDateTo) {
          const toDate = new Date(nextDueDateTo);
          toDate.setHours(23, 59, 59, 999); // Include the entire end day
          if (dueDate > toDate) return false;
        }
        return true;
      });
    }

    return combined;
  }, [clientServices, peopleServices, searchTerm, roleFilter, userFilter, nextStartDateFrom, nextStartDateTo, targetDeliveryDateFrom, targetDeliveryDateTo, nextDueDateFrom, nextDueDateTo]);

  // Active filter count
  const activeFilterCount = () => {
    let count = 0;
    if (serviceFilter !== "all") count++;
    if (roleFilter !== "all") count++;
    if (userFilter !== "all") count++;
    if (serviceOwnerFilter !== "all") count++;
    if (showInactive) count++;
    if (searchTerm) count++;
    if (nextStartDateFrom) count++;
    if (nextStartDateTo) count++;
    if (targetDeliveryDateFrom) count++;
    if (targetDeliveryDateTo) count++;
    if (nextDueDateFrom) count++;
    if (nextDueDateTo) count++;
    return count;
  };

  const handleClearFilters = () => {
    setServiceFilter("all");
    setRoleFilter("all");
    setUserFilter("all");
    setServiceOwnerFilter("all");
    setShowInactive(false);
    setSearchTerm("");
    setNextStartDateFrom("");
    setNextStartDateTo("");
    setTargetDeliveryDateFrom("");
    setTargetDeliveryDateTo("");
    setNextDueDateFrom("");
    setNextDueDateTo("");
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

  // Helper to clear step animation timers
  const clearStepTimers = () => {
    stepTimersRef.current.forEach(timer => clearTimeout(timer));
    stepTimersRef.current = [];
  };

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
      // Clear any pending step timers to prevent race conditions
      clearStepTimers();
      queryClient.invalidateQueries({ queryKey: ["/api/service-assignments"] });
      // Update progress to show completion
      setReassignProgress({
        step: 'complete',
        currentStepIndex: 3,
        total: result.roleChanges || 0,
        roleChanges: result.roleChanges || 0,
        projectUpdates: result.projectUpdates || 0,
        chronologyEntries: result.chronologyEntries || 0,
      });
    },
    onError: (error: any) => {
      // Clear any pending step timers to prevent race conditions
      clearStepTimers();
      setReassignProgress({
        step: 'error',
        currentStepIndex: 0,
        total: 0,
        roleChanges: 0,
        projectUpdates: 0,
        chronologyEntries: 0,
        errorMessage: error?.message || 'An error occurred during reassignment',
      });
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
      targetDate?: string;
      target: 'start' | 'due' | 'target' | 'both' | 'all';
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

    // Use field names that match the schema: serviceId, roleId, userId, serviceOwnerId
    const filters = {
      serviceId: serviceFilter !== "all" ? serviceFilter : undefined,
      roleId: roleFilter !== "all" ? roleFilter : undefined,
      userId: userFilter !== "all" ? userFilter : undefined,
      serviceOwnerId: serviceOwnerFilter !== "all" ? serviceOwnerFilter : undefined,
      showInactive: showInactive || undefined,
      nextStartDateFrom: nextStartDateFrom || undefined,
      nextStartDateTo: nextStartDateTo || undefined,
      nextDueDateFrom: nextDueDateFrom || undefined,
      nextDueDateTo: nextDueDateTo || undefined,
    };

    saveViewMutation.mutate({
      name: newViewName.trim(),
      filters, // Pass as object, not JSON string
    });
  };

  const handleLoadView = (view: ServiceAssignmentView) => {
    try {
      const filters = typeof view.filters === 'string' ? JSON.parse(view.filters) : view.filters;
      // Support both old field names (serviceFilter) and new ones (serviceId)
      setServiceFilter(filters.serviceId || filters.serviceFilter || "all");
      setRoleFilter(filters.roleId || filters.roleFilter || "all");
      setUserFilter(filters.userId || filters.userFilter || "all");
      setServiceOwnerFilter(filters.serviceOwnerId || filters.serviceOwnerFilter || "all");
      setShowInactive(filters.showInactive || false);
      setNextStartDateFrom(filters.nextStartDateFrom || "");
      setNextStartDateTo(filters.nextStartDateTo || "");
      setNextDueDateFrom(filters.nextDueDateFrom || "");
      setNextDueDateTo(filters.nextDueDateTo || "");
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
    // Close the main dialog before opening the confirmation to avoid double-overlay
    setReassignDialogOpen(false);
    // Use a small delay to allow the first dialog to close before opening the confirmation
    setTimeout(() => {
      setReassignConfirmOpen(true);
    }, 100);
  };

  const handleConfirmReassignment = () => {
    setReassignConfirmOpen(false);
    // Clear any existing timers
    clearStepTimers();
    // Open progress dialog and set initial state
    setProgressDialogOpen(true);
    setReassignProgress({
      step: 'processing',
      currentStepIndex: 0,
      total: selectedIds.size,
      roleChanges: 0,
      projectUpdates: 0,
      chronologyEntries: 0,
    });

    // Simulate step progression for visual feedback (only updates if still processing)
    const timer1 = setTimeout(() => {
      setReassignProgress(prev => 
        prev?.step === 'processing' ? { ...prev, currentStepIndex: 1 } : prev
      );
    }, 500);
    const timer2 = setTimeout(() => {
      setReassignProgress(prev => 
        prev?.step === 'processing' ? { ...prev, currentStepIndex: 2 } : prev
      );
    }, 1000);
    stepTimersRef.current = [timer1, timer2];

    bulkReassignMutation.mutate({
      clientServiceIds: Array.from(selectedIds),
      fromRoleId: reassignRoleId,
      toUserId: reassignToUserId,
    });
  };
  
  const handleCloseProgressDialog = () => {
    setProgressDialogOpen(false);
    setReassignProgress(null);
    setReassignRoleId("");
    setReassignToUserId("");
    setSelectedIds(new Set());
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
      if (dateEditTarget === 'target' && !setTargetDate) {
        showFriendlyError({ error: "Please select a target delivery date" });
        return;
      }
      if (dateEditTarget === 'both' && (!setStartDate || !setDueDate)) {
        showFriendlyError({ error: "Please select both start and due dates" });
        return;
      }
      if (dateEditTarget === 'all' && (!setStartDate || !setDueDate || !setTargetDate)) {
        showFriendlyError({ error: "Please select all three dates (start, due, and target delivery)" });
        return;
      }
      bulkDateEditMutation.mutate({
        serviceIds: clientServiceIds,
        serviceType: 'client',
        mode: 'set',
        startDate: setStartDate || undefined,
        dueDate: setDueDate || undefined,
        targetDate: setTargetDate || undefined,
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
  
  // UX safeguards for bulk operations
  // Date editing requires a single service type to be selected in filters
  const canBulkEditDates = serviceFilter !== "all";
  const dateEditDisabledReason = !canBulkEditDates 
    ? "Select a specific service type in filters to enable bulk date editing" 
    : null;
  
  // Role reassignment requires both a service type AND a user to be selected
  const canBulkReassignRoles = serviceFilter !== "all" && userFilter !== "all";
  const reassignDisabledReason = !canBulkReassignRoles 
    ? "Select a specific service type and user in filters to enable bulk role reassignment" 
    : null;

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

              {/* Show/Hide Roles Toggle */}
              <Button
                variant="outline"
                onClick={() => setShowRoleColumns(!showRoleColumns)}
                data-testid="button-toggle-roles"
              >
                {showRoleColumns ? (
                  <><EyeOff className="w-4 h-4 mr-2" /> Hide Roles</>
                ) : (
                  <><Eye className="w-4 h-4 mr-2" /> Show Roles</>
                )}
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

            {/* Bulk Actions (Admin only) */}
            {isAdmin && selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" data-testid="text-selected-count">
                  {selectedIds.size} selected
                </Badge>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          variant="default"
                          onClick={() => setReassignDialogOpen(true)}
                          disabled={!canBulkReassignRoles}
                          data-testid="button-bulk-reassign"
                        >
                          <ArrowRightLeft className="w-4 h-4 mr-2" />
                          Reassign Roles
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {reassignDisabledReason && (
                      <TooltipContent>
                        <p>{reassignDisabledReason}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          variant="outline"
                          onClick={() => setDateEditDialogOpen(true)}
                          disabled={!canBulkEditDates}
                          data-testid="button-bulk-dates"
                        >
                          <CalendarClock className="w-4 h-4 mr-2" />
                          Edit Dates
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {dateEditDisabledReason && (
                      <TooltipContent>
                        <p>{dateEditDisabledReason}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
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

          {/* Results Summary with Pagination Info */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground" data-testid="text-results-count">
              Showing {Math.min((currentPage - 1) * pageSize + 1, allAssignments.length)}-{Math.min(currentPage * pageSize, allAssignments.length)} of {allAssignments.length} service assignment{allAssignments.length !== 1 ? 's' : ''}
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
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows per page:</span>
              <Select 
                value={pageSize.toString()} 
                onValueChange={(value) => {
                  setPageSize(parseInt(value));
                  setCurrentPage(1); // Reset to first page when changing page size
                }}
              >
                <SelectTrigger className="w-[80px]" data-testid="select-page-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                    {showRoleColumns && allRolesInData.map(role => (
                      <TableHead key={role.id} className="text-xs">
                        {role.name}
                      </TableHead>
                    ))}
                    <TableHead>Service Owner</TableHead>
                    <TableHead>Next Start</TableHead>
                    <TableHead>Next Due</TableHead>
                    <TableHead>Target Delivery</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allAssignments
                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                    .map((assignment) => {
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
                          {showRoleColumns && allRolesInData.map(role => {
                            if (isClientService && cs?.roleAssignments) {
                              const assignment = cs.roleAssignments.find(
                                ra => ra.workRoleId === role.id && ra.isActive
                              );
                              if (assignment) {
                                return (
                                  <TableCell key={role.id} className="text-sm">
                                    <span title={`${assignment.user.firstName} ${assignment.user.lastName}`}>
                                      {assignment.user.firstName} {assignment.user.lastName?.charAt(0)}.
                                    </span>
                                  </TableCell>
                                );
                              }
                            }
                            return (
                              <TableCell key={role.id} className="text-center">
                                <span className="text-muted-foreground">✕</span>
                              </TableCell>
                            );
                          })}
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
                            {assignment.targetDeliveryDate ? (
                              <span className="text-sm text-purple-600 dark:text-purple-400" data-testid={`text-target-delivery-${assignment.id}`}>
                                {format(new Date(assignment.targetDeliveryDate), 'dd MMM yyyy')}
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

                        {/* Expanded - Active Projects */}
                        {isExpanded && isClientService && (
                          <TableRow className="bg-muted/30" key={`expanded-${assignment.id}`}>
                            <TableCell colSpan={
                              (isAdmin ? 1 : 0) + // Admin checkbox column
                              1 + // Expand button column
                              3 + // Type, Client/Person, Service columns
                              (showRoleColumns ? allRolesInData.length : 0) + // Role columns
                              6 // Service Owner, Next Start, Next Due, Target Delivery, Frequency, Status
                            } className="py-3">
                              <div className="pl-12">
                                <p className="text-sm font-medium mb-3 flex items-center gap-2">
                                  <FolderKanban className="w-4 h-4" />
                                  Active Projects
                                </p>
                                <ActiveProjectsSection clientServiceId={cs!.id} />
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
              
              {/* Pagination Controls */}
              {allAssignments.length > pageSize && (
                <div className="flex items-center justify-between p-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {Math.ceil(allAssignments.length / pageSize)}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      data-testid="button-first-page"
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      data-testid="button-prev-page"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(allAssignments.length / pageSize), p + 1))}
                      disabled={currentPage >= Math.ceil(allAssignments.length / pageSize)}
                      data-testid="button-next-page"
                    >
                      Next
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.ceil(allAssignments.length / pageSize))}
                      disabled={currentPage >= Math.ceil(allAssignments.length / pageSize)}
                      data-testid="button-last-page"
                    >
                      Last
                    </Button>
                  </div>
                </div>
              )}
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
                setSelectedIds(new Set()); // Clear selections when filter changes
                setCurrentPage(1); // Reset to first page when filter changes
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
                onValueChange={(value) => {
                  setRoleFilter(value);
                  setSelectedIds(new Set()); // Clear selections when filter changes
                  setCurrentPage(1); // Reset to first page when filter changes
                }}
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
              <Select value={userFilter} onValueChange={(value) => {
                setUserFilter(value);
                setSelectedIds(new Set()); // Clear selections when filter changes
                setCurrentPage(1); // Reset to first page when filter changes
              }}>
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

            {/* Next Start Date Range Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Next Start Date Range
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <div className="flex gap-1">
                    <Input
                      type="date"
                      value={nextStartDateFrom}
                      onChange={(e) => {
                        setNextStartDateFrom(e.target.value);
                        setCurrentPage(1);
                      }}
                      data-testid="input-start-date-from"
                      className="text-sm"
                    />
                    {nextStartDateFrom && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 shrink-0"
                        onClick={() => setNextStartDateFrom("")}
                        data-testid="button-clear-start-date-from"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <div className="flex gap-1">
                    <Input
                      type="date"
                      value={nextStartDateTo}
                      onChange={(e) => {
                        setNextStartDateTo(e.target.value);
                        setCurrentPage(1);
                      }}
                      data-testid="input-start-date-to"
                      className="text-sm"
                    />
                    {nextStartDateTo && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 shrink-0"
                        onClick={() => setNextStartDateTo("")}
                        data-testid="button-clear-start-date-to"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Target Delivery Date Range Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-purple-600" />
                Target Delivery Date Range
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <div className="flex gap-1">
                    <Input
                      type="date"
                      value={targetDeliveryDateFrom}
                      onChange={(e) => {
                        setTargetDeliveryDateFrom(e.target.value);
                        setCurrentPage(1);
                      }}
                      data-testid="input-target-delivery-date-from"
                      className="text-sm"
                    />
                    {targetDeliveryDateFrom && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 shrink-0"
                        onClick={() => setTargetDeliveryDateFrom("")}
                        data-testid="button-clear-target-delivery-date-from"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <div className="flex gap-1">
                    <Input
                      type="date"
                      value={targetDeliveryDateTo}
                      onChange={(e) => {
                        setTargetDeliveryDateTo(e.target.value);
                        setCurrentPage(1);
                      }}
                      data-testid="input-target-delivery-date-to"
                      className="text-sm"
                    />
                    {targetDeliveryDateTo && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 shrink-0"
                        onClick={() => setTargetDeliveryDateTo("")}
                        data-testid="button-clear-target-delivery-date-to"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Next Due Date Range Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4" />
                Next Due Date Range
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <div className="flex gap-1">
                    <Input
                      type="date"
                      value={nextDueDateFrom}
                      onChange={(e) => {
                        setNextDueDateFrom(e.target.value);
                        setCurrentPage(1);
                      }}
                      data-testid="input-due-date-from"
                      className="text-sm"
                    />
                    {nextDueDateFrom && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 shrink-0"
                        onClick={() => setNextDueDateFrom("")}
                        data-testid="button-clear-due-date-from"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <div className="flex gap-1">
                    <Input
                      type="date"
                      value={nextDueDateTo}
                      onChange={(e) => {
                        setNextDueDateTo(e.target.value);
                        setCurrentPage(1);
                      }}
                      data-testid="input-due-date-to"
                      className="text-sm"
                    />
                    {nextDueDateTo && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 shrink-0"
                        onClick={() => setNextDueDateTo("")}
                        data-testid="button-clear-due-date-to"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
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

      {/* Reassignment Progress Dialog */}
      <Dialog open={progressDialogOpen} onOpenChange={(open) => {
        // Only allow closing if complete or error
        if (!open && reassignProgress?.step !== 'processing') {
          handleCloseProgressDialog();
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {reassignProgress?.step === 'complete' ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : reassignProgress?.step === 'error' ? (
                <AlertCircle className="w-5 h-5 text-red-600" />
              ) : (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              )}
              {reassignProgress?.step === 'complete' ? 'Reassignment Complete' : 
               reassignProgress?.step === 'error' ? 'Reassignment Failed' : 
               'Processing Reassignment'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Step indicators */}
            <div className="space-y-3">
              {/* Step 1: Updating Service Assignments */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  (reassignProgress?.currentStepIndex ?? 0) > 0 || reassignProgress?.step === 'complete'
                    ? 'bg-green-100 text-green-600'
                    : (reassignProgress?.currentStepIndex ?? 0) === 0 && reassignProgress?.step === 'processing'
                      ? 'bg-primary/10 text-primary animate-pulse'
                      : 'bg-muted text-muted-foreground'
                }`}>
                  {(reassignProgress?.currentStepIndex ?? 0) > 0 || reassignProgress?.step === 'complete' ? (
                    <Check className="w-4 h-4" />
                  ) : (reassignProgress?.currentStepIndex ?? 0) === 0 && reassignProgress?.step === 'processing' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span className="text-sm font-medium">1</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Updating service assignments</p>
                  <p className="text-xs text-muted-foreground">
                    Changing role assignments on selected services
                  </p>
                </div>
              </div>

              {/* Step 2: Updating Projects */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  (reassignProgress?.currentStepIndex ?? 0) > 1 || reassignProgress?.step === 'complete'
                    ? 'bg-green-100 text-green-600'
                    : (reassignProgress?.currentStepIndex ?? 0) === 1 && reassignProgress?.step === 'processing'
                      ? 'bg-primary/10 text-primary animate-pulse'
                      : 'bg-muted text-muted-foreground'
                }`}>
                  {(reassignProgress?.currentStepIndex ?? 0) > 1 || reassignProgress?.step === 'complete' ? (
                    <Check className="w-4 h-4" />
                  ) : (reassignProgress?.currentStepIndex ?? 0) === 1 && reassignProgress?.step === 'processing' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span className="text-sm font-medium">2</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Updating active projects</p>
                  <p className="text-xs text-muted-foreground">
                    Updating role on any linked active projects
                  </p>
                </div>
              </div>

              {/* Step 3: Logging to Chronology */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  (reassignProgress?.currentStepIndex ?? 0) > 2 || reassignProgress?.step === 'complete'
                    ? 'bg-green-100 text-green-600'
                    : (reassignProgress?.currentStepIndex ?? 0) === 2 && reassignProgress?.step === 'processing'
                      ? 'bg-primary/10 text-primary animate-pulse'
                      : 'bg-muted text-muted-foreground'
                }`}>
                  {(reassignProgress?.currentStepIndex ?? 0) > 2 || reassignProgress?.step === 'complete' ? (
                    <Check className="w-4 h-4" />
                  ) : (reassignProgress?.currentStepIndex ?? 0) === 2 && reassignProgress?.step === 'processing' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span className="text-sm font-medium">3</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Recording changes</p>
                  <p className="text-xs text-muted-foreground">
                    Logging changes to project chronologies
                  </p>
                </div>
              </div>
            </div>

            {/* Results summary - shown when complete */}
            {reassignProgress?.step === 'complete' && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Summary
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Services updated:</span>
                  <span className="font-medium">{reassignProgress.roleChanges}</span>
                  <span className="text-muted-foreground">Projects updated:</span>
                  <span className="font-medium">{reassignProgress.projectUpdates}</span>
                  <span className="text-muted-foreground">Chronology entries:</span>
                  <span className="font-medium">{reassignProgress.chronologyEntries}</span>
                </div>
              </div>
            )}

            {/* Error message - shown when error */}
            {reassignProgress?.step === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">
                  {reassignProgress.errorMessage || 'An unexpected error occurred during reassignment.'}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              onClick={handleCloseProgressDialog}
              disabled={reassignProgress?.step === 'processing'}
              data-testid="button-close-progress"
            >
              {reassignProgress?.step === 'processing' ? 'Processing...' : 'Done'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                onValueChange={(value: 'start' | 'due' | 'target' | 'both' | 'all') => setDateEditTarget(value)}
              >
                <SelectTrigger data-testid="select-date-target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All dates (start, due, and target)</SelectItem>
                  <SelectItem value="both">Start and due dates</SelectItem>
                  <SelectItem value="start">Start date only</SelectItem>
                  <SelectItem value="due">Due date only</SelectItem>
                  <SelectItem value="target">Target delivery date only</SelectItem>
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
                {(dateEditTarget === 'start' || dateEditTarget === 'both' || dateEditTarget === 'all') && (
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
                {(dateEditTarget === 'due' || dateEditTarget === 'both' || dateEditTarget === 'all') && (
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
                {(dateEditTarget === 'target' || dateEditTarget === 'all') && (
                  <div className="space-y-2">
                    <Label htmlFor="set-target-date" className="text-purple-600 dark:text-purple-400">New Target Delivery Date</Label>
                    <Input
                      id="set-target-date"
                      type="date"
                      value={setTargetDate}
                      onChange={(e) => setSetTargetDate(e.target.value)}
                      data-testid="input-set-target-date"
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
