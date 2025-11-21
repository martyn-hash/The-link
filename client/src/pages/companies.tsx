import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation as useRouterLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Client, type CompanyView, type Person, type ClientPortalUser } from "@shared/schema";
import TopNavigation from "@/components/top-navigation";
import BottomNav from "@/components/bottom-nav";
import SuperSearch from "@/components/super-search";
import CompaniesTable from "@/components/companies-table";
import CompanyFilterPanel from "@/components/company-filter-panel";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Building, RefreshCw, AlertTriangle, Filter, ChevronDown, User, Search, Settings2, GripVertical, Check, Eye, Building2, AlertCircle } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type PersonWithPortalStatus = Person & {
  portalUser?: ClientPortalUser | null;
  relatedCompanies?: Client[];
};

interface ColumnConfig {
  id: string;
  label: string;
  sortable: boolean;
  defaultVisible: boolean;
  minWidth?: number;
}

const ALL_COLUMNS: ColumnConfig[] = [
  { id: "name", label: "Name", sortable: true, defaultVisible: true, minWidth: 200 },
  { id: "primaryEmail", label: "Primary Email", sortable: true, defaultVisible: true, minWidth: 200 },
  { id: "primaryPhone", label: "Primary Phone", sortable: true, defaultVisible: true, minWidth: 150 },
  { id: "hasAccessed", label: "Has Accessed App", sortable: true, defaultVisible: true, minWidth: 150 },
  { id: "pushEnabled", label: "Push Enabled", sortable: true, defaultVisible: true, minWidth: 130 },
  { id: "dateOfBirth", label: "Date of Birth", sortable: true, defaultVisible: false, minWidth: 150 },
  { id: "nationality", label: "Nationality", sortable: true, defaultVisible: false, minWidth: 150 },
  { id: "occupation", label: "Occupation", sortable: true, defaultVisible: false, minWidth: 150 },
  { id: "relatedCompanies", label: "Related Companies", sortable: false, defaultVisible: true, minWidth: 200 },
  { id: "companyCount", label: "Company Count", sortable: true, defaultVisible: false, minWidth: 130 },
  { id: "actions", label: "Actions", sortable: false, defaultVisible: true, minWidth: 100 },
];

function SortableColumnSettingsItem({ columnId, column, visibleColumns, onToggle }: {
  columnId: string;
  column: ColumnConfig;
  visibleColumns: string[];
  onToggle: (columnId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: columnId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center space-x-2 p-2 border rounded hover:bg-muted/50"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      <Checkbox
        checked={visibleColumns.includes(columnId)}
        onCheckedChange={() => onToggle(columnId)}
        data-testid={`checkbox-column-${columnId}`}
      />
      <label className="flex-1 text-sm cursor-pointer">{column.label}</label>
    </div>
  );
}

function SortableColumnHeader({ column, sortBy, sortOrder, onSort, width, onResize, onResizeComplete }: {
  column: ColumnConfig;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort?: (columnId: string) => void;
  width?: number;
  onResize?: (columnId: string, width: number) => void;
  onResizeComplete?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    width: width ? `${width}px` : undefined,
    minWidth: column.minWidth ? `${column.minWidth}px` : undefined,
  };

  const [isResizing, setIsResizing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const resizeCompleteRef = useRef<(() => void) | null>(null);

  // Store the onResizeComplete callback in a ref to call it only once on mouseup
  useEffect(() => {
    resizeCompleteRef.current = onResizeComplete || null;
  }, [onResizeComplete]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!onResize) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setStartX(e.clientX);
    setStartWidth(width || column.minWidth || 100);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!onResize) return;
      const diff = e.clientX - startX;
      const newWidth = Math.max(column.minWidth || 50, startWidth + diff);
      onResize(column.id, newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      // Save preferences after resize completes - call from ref to avoid stale closures
      if (resizeCompleteRef.current) {
        resizeCompleteRef.current();
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      // Don't call onResizeComplete in cleanup - only in handleMouseUp
    };
  }, [isResizing, startX, startWidth, column.id, column.minWidth, onResize]);

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      className={`relative ${column.sortable && onSort ? "cursor-pointer hover:bg-muted/50" : ""}`}
      onClick={() => column.sortable && onSort && onSort(column.id)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {column.id !== "actions" && (
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          <span>
            {column.label} {column.sortable && sortBy === column.id && (sortOrder === "asc" ? "↑" : "↓")}
          </span>
        </div>
        {onResize && column.id !== "actions" && (
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary"
            onMouseDown={handleMouseDown}
          />
        )}
      </div>
    </TableHead>
  );
}

function formatPersonName(fullName: string): string {
  if (!fullName) return '';
  
  if (fullName.includes(',')) {
    const [lastName, firstName] = fullName.split(',').map(part => part.trim());
    const formattedFirstName = firstName.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    const formattedLastName = lastName.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    return `${formattedFirstName} ${formattedLastName}`;
  }
  
  return fullName;
}

function formatBirthDate(dateOfBirth: string | Date | null): string {
  if (!dateOfBirth) return '-';
  
  if (typeof dateOfBirth === 'string') {
    const partialDatePattern = /^(\d{4})-(\d{2})(?:-01(?:T00:00:00(?:\.\d+)?Z?)?)?$/;
    const match = dateOfBirth.match(partialDatePattern);
    
    if (match) {
      const [, year, month] = match;
      const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
      
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      return date.toLocaleDateString('en-GB', { 
        month: 'long', 
        year: 'numeric',
        timeZone: 'UTC'
      });
    }
  }
  
  const date = new Date(dateOfBirth);
  
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }
  
  return date.toLocaleDateString('en-GB', {
    timeZone: 'UTC'
  });
}

export default function Companies() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClientInstance = useQueryClient();
  const isMobile = useIsMobile();
  const [location, setLocation] = useRouterLocation();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<string>("companies");
  
  // Companies tab state
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [syncResults, setSyncResults] = useState<any>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [daysUntilDueFilter, setDaysUntilDueFilter] = useState<string[]>([]);

  // People tab state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [settingsOpen, setSettingsOpen] = useState(false);

  interface SavedPreferences {
    visibleColumns?: string[];
    columnOrder?: string[];
    columnWidths?: Record<string, number>;
  }

  const { data: savedPreferences } = useQuery<SavedPreferences>({
    queryKey: ["/api/column-preferences", "people"],
    enabled: isAuthenticated && !!user && activeTab === "people",
  });

  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    ALL_COLUMNS.filter(col => col.defaultVisible).map(col => col.id)
  );
  const [columnOrder, setColumnOrder] = useState<string[]>(
    ALL_COLUMNS.map(col => col.id)
  );
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  useEffect(() => {
    if (savedPreferences) {
      if (savedPreferences.visibleColumns) {
        setVisibleColumns(savedPreferences.visibleColumns);
      }
      if (savedPreferences.columnOrder) {
        setColumnOrder(savedPreferences.columnOrder);
      }
      if (savedPreferences.columnWidths) {
        setColumnWidths(savedPreferences.columnWidths);
      }
    }
  }, [savedPreferences]);

  const savePreferencesMutation = useMutation({
    mutationFn: async (preferences: SavedPreferences) => {
      return await apiRequest("POST", "/api/column-preferences", {
        page: "people",
        preferences,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/column-preferences", "people"] });
    },
  });

  const savePreferences = (prefs: Partial<SavedPreferences>) => {
    savePreferencesMutation.mutate({
      visibleColumns,
      columnOrder,
      columnWidths,
      ...prefs,
    });
  };

  const handleColumnToggle = (columnId: string) => {
    const newVisibleColumns = visibleColumns.includes(columnId)
      ? visibleColumns.filter(id => id !== columnId)
      : [...visibleColumns, columnId];
    
    setVisibleColumns(newVisibleColumns);
    // Save immediately on toggle (discrete action)
    savePreferences({ visibleColumns: newVisibleColumns });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = columnOrder.indexOf(active.id as string);
    const newIndex = columnOrder.indexOf(over.id as string);
    const newOrder = arrayMove(columnOrder, oldIndex, newIndex);
    
    setColumnOrder(newOrder);
    // Save immediately after drag (discrete action)
    savePreferences({ columnOrder: newOrder });
  };

  const handleResize = (columnId: string, width: number) => {
    const newWidths = { ...columnWidths, [columnId]: width };
    setColumnWidths(newWidths);
    // Only update state during resize, save happens on mouseup
  };

  const handleResizeComplete = () => {
    // Save after resize completes
    savePreferences({ columnWidths });
  };

  const handleSort = (columnId: string) => {
    if (sortBy === columnId) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(columnId);
      setSortOrder("asc");
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    if (searchParam) {
      setSearchTerm(searchParam);
    }
  }, [location]);

  // Fetch all clients
  const { data: allClients, isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Fetch people
  const { data: people, isLoading: peopleLoading, error: peopleError } = useQuery<PersonWithPortalStatus[]>({
    queryKey: ["/api/people"],
    enabled: isAuthenticated && !!user && activeTab === "people",
    retry: false,
  });

  // Fetch services for filter
  const { data: allServices = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/services"],
    enabled: isAuthenticated && activeTab === "companies",
    retry: false,
    select: (data: any[]) => data.map(s => ({ id: s.id, name: s.name })).sort((a, b) => a.name.localeCompare(b.name))
  });

  // Fetch tags for filter
  const { data: allTags = [] } = useQuery<Array<{ id: string; name: string; color: string }>>({
    queryKey: ["/api/client-tags"],
    enabled: isAuthenticated && activeTab === "companies",
    retry: false,
  });

  // Fetch saved views
  const { data: savedViews = [] } = useQuery<CompanyView[]>({
    queryKey: ["/api/company-views"],
    enabled: isAuthenticated && activeTab === "companies",
    retry: false,
  });

  // Auth checks
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  useEffect(() => {
    if (peopleError && isUnauthorizedError(peopleError)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [peopleError, toast]);

  // Filter clients with Companies House connections (must have company number)
  const companiesHouseClients = allClients?.filter(client => 
    client.companyNumber
  ) || [];

  // Bulk sync mutation
  const syncMutation = useMutation({
    mutationFn: async (clientIds: string[]) => {
      const results = {
        successful: [] as string[],
        failed: [] as { clientId: string; error: string }[],
      };

      for (const clientId of clientIds) {
        try {
          await apiRequest("POST", `/api/companies-house/sync/${clientId}`);
          results.successful.push(clientId);
        } catch (error) {
          results.failed.push({
            clientId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      setSyncResults(results);
      setShowSyncDialog(true);
      queryClientInstance.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClientInstance.invalidateQueries({ queryKey: ["/api/ch-change-requests/grouped"] });
      setSelectedClients(new Set());
      
      const successCount = results.successful.length;
      const failCount = results.failed.length;
      
      toast({
        title: "Sync Complete",
        description: `Successfully synced ${successCount} client${successCount !== 1 ? 's' : ''}${failCount > 0 ? `, ${failCount} failed` : ''}.`,
        variant: successCount > 0 ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync Companies House data",
        variant: "destructive",
      });
    },
  });

  // Bulk enrichment mutation
  const enrichMutation = useMutation({
    mutationFn: async (clientIds: string[]) => {
      const response = await apiRequest("POST", "/api/companies-house/enrich-bulk", { clientIds });
      return response as {
        successful: string[];
        failed: { clientId: string; clientName: string; error: string }[];
        skipped: { clientId: string; clientName: string; reason: string }[];
      };
    },
    onSuccess: (results) => {
      setSyncResults(results);
      setShowSyncDialog(true);
      queryClientInstance.invalidateQueries({ queryKey: ["/api/clients"] });
      setSelectedClients(new Set());
      
      const successCount = results.successful.length;
      const failCount = results.failed.length;
      const skipCount = results.skipped.length;
      
      toast({
        title: "Enrichment Complete",
        description: `Successfully enriched ${successCount} client${successCount !== 1 ? 's' : ''}${skipCount > 0 ? `, ${skipCount} skipped` : ''}${failCount > 0 ? `, ${failCount} failed` : ''}.`,
        variant: successCount > 0 ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Enrichment Failed",
        description: error.message || "Failed to enrich clients with Companies House data",
        variant: "destructive",
      });
    },
  });

  const handleSelectAll = (checked: boolean, filteredClientIds?: string[]) => {
    const clientIds = filteredClientIds || companiesHouseClients.map(c => c.id);
    setSelectedClients(checked ? new Set(clientIds) : new Set());
  };

  const handleSelectClient = (clientId: string, checked: boolean) => {
    const newSelected = new Set(selectedClients);
    if (checked) {
      newSelected.add(clientId);
    } else {
      newSelected.delete(clientId);
    }
    setSelectedClients(newSelected);
  };

  const handleSyncSelected = () => {
    if (selectedClients.size === 0) {
      toast({
        title: "No Clients Selected",
        description: "Please select at least one client to sync.",
        variant: "destructive",
      });
      return;
    }
    syncMutation.mutate(Array.from(selectedClients));
  };

  const handleEnrichSelected = () => {
    if (selectedClients.size === 0) {
      toast({
        title: "No Clients Selected",
        description: "Please select at least one client to enrich.",
        variant: "destructive",
      });
      return;
    }
    enrichMutation.mutate(Array.from(selectedClients));
  };

  const handleLoadView = (view: CompanyView) => {
    const filters = typeof view.filters === 'string' 
      ? JSON.parse(view.filters) 
      : view.filters as any;
    
    setSelectedServices(filters.selectedServices || []);
    setSelectedTags(filters.selectedTags || []);
    setDaysUntilDueFilter(filters.daysUntilDueFilter || []);
  };

  const activeFilterCount = () => {
    let count = 0;
    if (selectedServices.length > 0) count++;
    if (selectedTags.length > 0) count++;
    if (daysUntilDueFilter.length > 0) count++;
    return count;
  };

  // People filtering and sorting
  const filteredPeople = people?.filter(person =>
    person.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (person.email && person.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (person.primaryEmail && person.primaryEmail.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  const sortedPeople = [...filteredPeople].sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (sortBy) {
      case "name":
        aVal = a.fullName || "";
        bVal = b.fullName || "";
        break;
      case "primaryEmail":
        aVal = a.primaryEmail || a.email || "";
        bVal = b.primaryEmail || b.email || "";
        break;
      case "primaryPhone":
        aVal = a.primaryPhone || a.telephone || "";
        bVal = b.primaryPhone || b.telephone || "";
        break;
      case "hasAccessed":
        aVal = a.portalUser?.lastLogin ? 1 : 0;
        bVal = b.portalUser?.lastLogin ? 1 : 0;
        break;
      case "pushEnabled":
        aVal = a.portalUser?.pushNotificationsEnabled ? 1 : 0;
        bVal = b.portalUser?.pushNotificationsEnabled ? 1 : 0;
        break;
      case "dateOfBirth":
        aVal = a.dateOfBirth || "";
        bVal = b.dateOfBirth || "";
        break;
      case "companyCount":
        aVal = a.relatedCompanies?.length || 0;
        bVal = b.relatedCompanies?.length || 0;
        break;
      default:
        aVal = "";
        bVal = "";
    }

    if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
    if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const orderedColumns = columnOrder
    .map(id => ALL_COLUMNS.find(col => col.id === id))
    .filter((col): col is ColumnConfig => col !== undefined && visibleColumns.includes(col.id));

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-muted-foreground mb-2">Authentication Required</h1>
          <p className="text-muted-foreground">Please log in to access this page.</p>
        </div>
      </div>
    );
  }

  if (clientsLoading && activeTab === "companies") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopNavigation user={user} />
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
      
      {/* Page Header */}
      <div className="border-b border-border bg-card">
        <div className="page-container py-6 md:py-8">
          <div className="flex items-center space-x-3 mb-4">
            <Building className="w-6 h-6 text-primary" />
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight" data-testid="text-page-title">
              Clients
            </h1>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList>
              <TabsTrigger value="companies" data-testid="tab-companies">
                Companies
                {activeTab === "companies" && (
                  <Badge variant="secondary" className="ml-2">
                    {companiesHouseClients.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="people" data-testid="tab-people">
                People
                {activeTab === "people" && people && (
                  <Badge variant="secondary" className="ml-2">
                    {people.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Companies Tab Content */}
            <TabsContent value="companies" className="mt-6">
              <div className="flex items-center justify-between mb-6">
                <Badge variant="outline" data-testid="text-companies-count">
                  {companiesHouseClients.length} {companiesHouseClients.length === 1 ? 'Company' : 'Companies'}
                </Badge>
                <div className="flex items-center gap-2">
                  {savedViews.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" data-testid="button-load-saved-view">
                          <span>Load saved view</span>
                          <ChevronDown className="ml-2 w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {savedViews.map((view) => (
                          <DropdownMenuItem
                            key={view.id}
                            onClick={() => handleLoadView(view)}
                            data-testid={`menuitem-load-view-${view.id}`}
                          >
                            {view.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
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

              {companiesHouseClients.length === 0 ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <Building className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-medium text-muted-foreground mb-2">No Companies Found</h3>
                    <p className="text-muted-foreground">
                      No clients with Companies House connections
                    </p>
                  </div>
                </div>
              ) : (
                <CompaniesTable
                  clients={companiesHouseClients}
                  selectedClients={selectedClients}
                  onSelectClient={handleSelectClient}
                  onSelectAll={handleSelectAll}
                  onSyncSelected={handleSyncSelected}
                  isSyncing={syncMutation.isPending}
                  onEnrichSelected={handleEnrichSelected}
                  isEnriching={enrichMutation.isPending}
                  selectedServices={selectedServices}
                  selectedTags={selectedTags}
                  daysUntilDueFilter={daysUntilDueFilter}
                />
              )}
            </TabsContent>

            {/* People Tab Content */}
            <TabsContent value="people" className="mt-6">
              <div className="flex items-center justify-between mb-6">
                <div className="relative max-w-sm flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Search people..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-people"
                  />
                </div>
                <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-column-settings">
                      <Settings2 className="w-4 h-4 mr-2" />
                      Columns
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Column Settings</DialogTitle>
                    </DialogHeader>
                    {settingsOpen && (
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Select which columns to display and drag to reorder
                        </p>
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleDragEnd}
                        >
                          <SortableContext
                            items={columnOrder.filter(id => {
                              const col = ALL_COLUMNS.find(c => c.id === id);
                              return col && col.id !== "actions";
                            })}
                            strategy={horizontalListSortingStrategy}
                          >
                            <div className="space-y-2">
                              {columnOrder
                                .filter(id => {
                                  const col = ALL_COLUMNS.find(c => c.id === id);
                                  return col && col.id !== "actions";
                                })
                                .map((columnId) => {
                                  const column = ALL_COLUMNS.find(c => c.id === columnId)!;
                                  return (
                                    <SortableColumnSettingsItem
                                      key={columnId}
                                      columnId={columnId}
                                      column={column}
                                      visibleColumns={visibleColumns}
                                      onToggle={handleColumnToggle}
                                    />
                                  );
                                })}
                            </div>
                          </SortableContext>
                        </DndContext>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>

              {peopleLoading ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  </CardContent>
                </Card>
              ) : peopleError ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Unable to load people</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    There was an issue loading the people list. Please try refreshing the page or contact support if the problem persists.
                  </p>
                </div>
              ) : sortedPeople.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  {searchTerm ? (
                    <>
                      <Search className="w-12 h-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2" data-testid="text-no-search-results">No people found</h3>
                      <p className="text-muted-foreground text-center max-w-md">
                        No people match your search for "{searchTerm}". Try adjusting your search terms.
                      </p>
                    </>
                  ) : (
                    <>
                      <User className="w-12 h-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2" data-testid="text-no-people">No people yet</h3>
                      <p className="text-muted-foreground text-center max-w-md mb-4">
                        There are no people in the system yet. People will appear here as they are added to the system.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <Card>
                  <div className="overflow-x-auto">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext items={orderedColumns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {orderedColumns.map((column) => (
                                <SortableColumnHeader
                                  key={column.id}
                                  column={column}
                                  sortBy={sortBy}
                                  sortOrder={sortOrder}
                                  onSort={column.sortable ? handleSort : undefined}
                                  width={columnWidths[column.id]}
                                  onResize={handleResize}
                                  onResizeComplete={handleResizeComplete}
                                />
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedPeople.map((person) => (
                              <TableRow key={person.id} data-testid={`row-person-${person.id}`}>
                                {orderedColumns.map((column) => {
                                  const cellStyle = {
                                    width: columnWidths[column.id] ? `${columnWidths[column.id]}px` : undefined,
                                    minWidth: column.minWidth ? `${column.minWidth}px` : undefined,
                                  };

                                  switch (column.id) {
                                    case "name":
                                      return (
                                        <TableCell key={column.id} style={cellStyle}>
                                          <div className="font-medium" data-testid={`text-person-name-${person.id}`}>
                                            {formatPersonName(person.fullName)}
                                          </div>
                                        </TableCell>
                                      );
                                    case "primaryEmail":
                                      return (
                                        <TableCell key={column.id} style={cellStyle}>
                                          <span className="text-sm" data-testid={`text-person-email-${person.id}`}>
                                            {person.primaryEmail || person.email || '-'}
                                          </span>
                                        </TableCell>
                                      );
                                    case "primaryPhone":
                                      return (
                                        <TableCell key={column.id} style={cellStyle}>
                                          <span className="text-sm" data-testid={`text-person-phone-${person.id}`}>
                                            {person.primaryPhone || person.telephone || '-'}
                                          </span>
                                        </TableCell>
                                      );
                                    case "hasAccessed":
                                      return (
                                        <TableCell key={column.id} style={cellStyle} className="text-center">
                                          {person.portalUser?.lastLogin ? (
                                            <Check className="h-4 w-4 text-green-500 mx-auto" data-testid={`icon-has-accessed-${person.id}`} />
                                          ) : (
                                            <span className="text-muted-foreground text-xs">-</span>
                                          )}
                                        </TableCell>
                                      );
                                    case "pushEnabled":
                                      return (
                                        <TableCell key={column.id} style={cellStyle} className="text-center">
                                          {person.portalUser?.pushNotificationsEnabled ? (
                                            <Check className="h-4 w-4 text-blue-500 mx-auto" data-testid={`icon-push-enabled-${person.id}`} />
                                          ) : (
                                            <span className="text-muted-foreground text-xs">-</span>
                                          )}
                                        </TableCell>
                                      );
                                    case "dateOfBirth":
                                      return (
                                        <TableCell key={column.id} style={cellStyle}>
                                          <span className="text-sm" data-testid={`text-person-dob-${person.id}`}>
                                            {formatBirthDate(person.dateOfBirth)}
                                          </span>
                                        </TableCell>
                                      );
                                    case "nationality":
                                      return (
                                        <TableCell key={column.id} style={cellStyle}>
                                          <span className="text-sm">{person.nationality || '-'}</span>
                                        </TableCell>
                                      );
                                    case "occupation":
                                      return (
                                        <TableCell key={column.id} style={cellStyle}>
                                          <span className="text-sm">{person.occupation || '-'}</span>
                                        </TableCell>
                                      );
                                    case "relatedCompanies":
                                      return (
                                        <TableCell key={column.id} style={cellStyle}>
                                          {person.relatedCompanies && person.relatedCompanies.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                              {person.relatedCompanies.slice(0, 2).map((client, index) => (
                                                <Badge
                                                  key={index}
                                                  variant="secondary"
                                                  className="text-xs cursor-pointer hover:bg-secondary/80"
                                                  onClick={() => setLocation(`/clients/${client.id}`)}
                                                  data-testid={`badge-company-${client.id}`}
                                                >
                                                  <Building2 className="w-3 h-3 mr-1" />
                                                  {client.name}
                                                </Badge>
                                              ))}
                                              {person.relatedCompanies.length > 2 && (
                                                <Badge variant="outline" className="text-xs">
                                                  +{person.relatedCompanies.length - 2} more
                                                </Badge>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-muted-foreground text-xs">-</span>
                                          )}
                                        </TableCell>
                                      );
                                    case "companyCount":
                                      return (
                                        <TableCell key={column.id} style={cellStyle} className="text-center">
                                          <Badge variant="secondary">{person.relatedCompanies?.length || 0}</Badge>
                                        </TableCell>
                                      );
                                    case "actions":
                                      return (
                                        <TableCell key={column.id} style={cellStyle}>
                                          <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() => setLocation(`/person/${person.id}`)}
                                            data-testid={`button-view-person-${person.id}`}
                                          >
                                            <Eye className="h-4 w-4 mr-2" />
                                            View
                                          </Button>
                                        </TableCell>
                                      );
                                    default:
                                      return <TableCell key={column.id} style={cellStyle}>-</TableCell>;
                                  }
                                })}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </SortableContext>
                    </DndContext>
                  </div>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Company Filter Panel - Only for Companies tab */}
      {activeTab === "companies" && (
        <CompanyFilterPanel
          open={filterPanelOpen}
          onOpenChange={setFilterPanelOpen}
          selectedServices={selectedServices}
          setSelectedServices={setSelectedServices}
          selectedTags={selectedTags}
          setSelectedTags={setSelectedTags}
          daysUntilDueFilter={daysUntilDueFilter}
          setDaysUntilDueFilter={setDaysUntilDueFilter}
          services={allServices}
          tags={allTags}
        />
      )}

      {/* Sync Results Dialog */}
      <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync Results</DialogTitle>
            <DialogDescription>
              Companies House data synchronization completed
            </DialogDescription>
          </DialogHeader>
          {syncResults && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <RefreshCw className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-green-900">Successfully Synced</span>
                </div>
                <p className="text-sm text-green-700">
                  {syncResults.successful.length} client{syncResults.successful.length !== 1 ? 's' : ''}
                </p>
              </div>

              {syncResults.failed.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="font-medium text-red-900">Failed</span>
                  </div>
                  <div className="space-y-1">
                    {syncResults.failed.map((fail: any, idx: number) => (
                      <p key={idx} className="text-sm text-red-700">
                        Client {fail.clientId}: {fail.error}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={() => setShowSyncDialog(false)}
                className="w-full"
                data-testid="button-close-results"
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Mobile Bottom Navigation */}
      <BottomNav onSearchClick={() => setMobileSearchOpen(true)} />

      {/* Mobile Search Modal */}
      <SuperSearch
        isOpen={mobileSearchOpen}
        onOpenChange={setMobileSearchOpen}
      />
    </div>
  );
}
