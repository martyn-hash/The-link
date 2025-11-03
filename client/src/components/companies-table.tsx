import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Client, type Service, type ClientService, type User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { differenceInDays } from "date-fns";
import {
  Building,
  RefreshCw,
  AlertTriangle,
  Calendar,
  Search,
  Eye,
  Settings2,
  GripVertical,
  Check,
  Save,
  ChevronDown,
  Trash2,
  Tag,
} from "lucide-react";

interface ColumnConfig {
  id: string;
  label: string;
  sortable?: boolean;
  defaultVisible: boolean;
  minWidth?: number;
  type?: "text" | "date" | "status" | "service" | "actions";
}

// Sortable column header component
function SortableColumnHeader({
  column,
  sortBy,
  sortOrder,
  onSort,
  width,
  onResize,
  allSelected,
  someSelected,
  onSelectAll,
  filteredClientIds,
}: {
  column: ColumnConfig;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort?: (columnId: string) => void;
  width?: number;
  onResize?: (columnId: string, width: number) => void;
  allSelected?: boolean;
  someSelected?: boolean;
  onSelectAll?: (checked: boolean, filteredClientIds?: string[]) => void;
  filteredClientIds?: string[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  });

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
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, startX, startWidth, column, onResize]);

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      className={`relative ${column.sortable && onSort ? "cursor-pointer hover:bg-muted/50" : ""}`}
      onClick={() => column.sortable && onSort && onSort(column.id)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {column.id !== "actions" && column.id !== "checkbox" && (
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          {column.id === "checkbox" && onSelectAll ? (
            <Checkbox
              checked={someSelected && !allSelected ? "indeterminate" : allSelected}
              onCheckedChange={(checked) => {
                // Convert CheckedState to boolean: true or "indeterminate" means select all, false means deselect all
                const shouldSelect = checked === true || checked === "indeterminate";
                // Pass the filtered client IDs so only visible clients are selected
                onSelectAll(shouldSelect, filteredClientIds);
              }}
              data-testid="checkbox-select-all"
              aria-label="Select all companies"
            />
          ) : (
            <span className="text-xs font-medium">
              {column.label}{" "}
              {column.sortable && sortBy === column.id && (sortOrder === "asc" ? "↑" : "↓")}
            </span>
          )}
        </div>
        {onResize && column.id !== "actions" && column.id !== "checkbox" && (
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary"
            onMouseDown={handleMouseDown}
          />
        )}
      </div>
    </TableHead>
  );
}

interface CompaniesTableProps {
  clients: Client[];
  selectedClients: Set<string>;
  onSelectClient: (clientId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean, filteredClientIds?: string[]) => void;
  onSyncSelected: () => void;
  isSyncing: boolean;
  onEnrichSelected: () => void;
  isEnriching: boolean;
  selectedServices?: string[];
  selectedTags?: string[];
  daysUntilDueFilter?: string[];
}

export default function CompaniesTable({
  clients,
  selectedClients,
  onSelectClient,
  onSelectAll,
  onSyncSelected,
  isSyncing,
  onEnrichSelected,
  isEnriching,
  selectedServices = [],
  selectedTags = [],
  daysUntilDueFilter = [],
}: CompaniesTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Fetch all services
  const { data: allServices = [] } = useQuery<Service[]>({
    queryKey: ["/api/services"],
    select: (data: Service[]) => data.filter(s => !s.isPersonalService && s.isActive).sort((a, b) => a.name.localeCompare(b.name)),
  });

  // Fetch all client-services relationships
  const { data: clientServices = [] } = useQuery<ClientService[]>({
    queryKey: ["/api/client-services"],
  });

  // Fetch all users (for service owners)
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch all client tags
  const { data: allTags = [] } = useQuery<any[]>({
    queryKey: ["/api/client-tags"],
  });

  // Fetch all client tag assignments
  const { data: tagAssignments = [] } = useQuery<any[]>({
    queryKey: ["/api/client-tag-assignments"],
  });

  // Fetch portal status for all clients
  const { data: portalStatus = {} } = useQuery<Record<string, { hasApp: number; pushEnabled: number }>>({
    queryKey: ["/api/portal-status"],
  });

  // State for saved layouts
  const [layoutName, setLayoutName] = useState("");
  const [saveLayoutDialogOpen, setSaveLayoutDialogOpen] = useState(false);

  // Build ALL_COLUMNS dynamically including service and tags columns
  const ALL_COLUMNS = useMemo<ColumnConfig[]>(() => {
    const baseColumns: ColumnConfig[] = [
      { id: "checkbox", label: "", defaultVisible: true, minWidth: 50, type: "text" },
      { id: "name", label: "Client Name", sortable: true, defaultVisible: true, minWidth: 200, type: "text" },
      { id: "companyNumber", label: "Company Number", sortable: true, defaultVisible: true, minWidth: 150, type: "text" },
      { id: "companyStatus", label: "Status", sortable: true, defaultVisible: true, minWidth: 150, type: "status" },
      { id: "tags", label: "Tags", sortable: false, defaultVisible: true, minWidth: 180, type: "text" },
      { id: "hasApp", label: "Has App", sortable: false, defaultVisible: true, minWidth: 100, type: "text" },
      { id: "pushEnabled", label: "Push Enabled", sortable: false, defaultVisible: true, minWidth: 120, type: "text" },
      { id: "csDue", label: "CS Due", sortable: true, defaultVisible: true, minWidth: 120, type: "date" },
      { id: "accountsDue", label: "Accounts Due", sortable: true, defaultVisible: true, minWidth: 140, type: "date" },
      { id: "csPeriodEnd", label: "CS Period End", sortable: false, defaultVisible: false, minWidth: 140, type: "date" },
      { id: "accountsPeriodEnd", label: "Accounts Period End", sortable: false, defaultVisible: false, minWidth: 180, type: "date" },
      { id: "companyType", label: "Company Type", sortable: false, defaultVisible: false, minWidth: 150, type: "text" },
      { id: "dateOfCreation", label: "Date of Creation", sortable: false, defaultVisible: false, minWidth: 150, type: "date" },
      { id: "jurisdiction", label: "Jurisdiction", sortable: false, defaultVisible: false, minWidth: 120, type: "text" },
    ];

    // Add service columns (all sortable)
    const serviceColumns: ColumnConfig[] = allServices.map(service => ({
      id: `service_${service.id}`,
      label: service.name,
      sortable: true,
      defaultVisible: false,
      minWidth: 150,
      type: "service" as const,
    }));

    const actionColumns: ColumnConfig[] = [
      { id: "actions", label: "Actions", defaultVisible: true, minWidth: 100, type: "actions" },
    ];

    return [...baseColumns, ...serviceColumns, ...actionColumns];
  }, [allServices]);

  interface SavedPreferences {
    columnOrder: string[];
    visibleColumns: string[];
    columnWidths: Record<string, number>;
  }

  // Column preferences state
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    ALL_COLUMNS.filter((col) => col.defaultVisible).map((col) => col.id)
  );
  const [columnOrder, setColumnOrder] = useState<string[]>(ALL_COLUMNS.map((col) => col.id));
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  // Load column preferences from API
  const { data: savedPreferences } = useQuery<SavedPreferences>({
    queryKey: ["/api/companies-column-preferences"],
  });

  // Save column preferences mutation
  const savePreferencesMutation = useMutation({
    mutationFn: async (preferences: SavedPreferences) => {
      return await apiRequest("POST", "/api/companies-column-preferences", preferences);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies-column-preferences"] });
    },
  });

  // Apply saved preferences on load
  useEffect(() => {
    if (savedPreferences && ALL_COLUMNS.length > 0) {
      // Apply column order - just use saved order directly
      if (savedPreferences.columnOrder) {
        setColumnOrder(savedPreferences.columnOrder);
      }
      
      // Apply visible columns - use saved preferences directly without merging defaults
      // This ensures user's explicit hide/show choices are respected
      if (savedPreferences.visibleColumns) {
        setVisibleColumns(savedPreferences.visibleColumns);
      }
      
      if (savedPreferences.columnWidths) {
        setColumnWidths(savedPreferences.columnWidths as Record<string, number>);
      }
    }
  }, [savedPreferences]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        // Save to backend after reordering
        setTimeout(() => {
          savePreferencesMutation.mutate({
            columnOrder: newOrder,
            visibleColumns,
            columnWidths,
          });
        }, 100);
        return newOrder;
      });
    }
  };

  const toggleColumnVisibility = (columnId: string) => {
    const newVisible = visibleColumns.includes(columnId)
      ? visibleColumns.filter((id) => id !== columnId)
      : [...visibleColumns, columnId];
    
    setVisibleColumns(newVisible);
    
    // Save to backend immediately (no setTimeout to avoid race conditions)
    savePreferencesMutation.mutate({
      columnOrder,
      visibleColumns: newVisible,
      columnWidths,
    });
  };

  const handleColumnResize = (columnId: string, width: number) => {
    setColumnWidths((prev) => ({
      ...prev,
      [columnId]: width,
    }));
    // Debounce save
    setTimeout(() => {
      savePreferencesMutation.mutate({
        columnOrder,
        visibleColumns,
        columnWidths,
      });
    }, 500);
  };

  // Build tags lookup map for O(1) access
  const tagsById = useMemo(() => {
    const map = new Map<string, any>();
    allTags.forEach((tag: any) => {
      map.set(tag.id, tag);
    });
    return map;
  }, [allTags]);

  // Build client tags map for quick lookup (needs to be before filteredClients)
  const clientTagsMap = useMemo(() => {
    const map = new Map<string, any[]>();
    tagAssignments.forEach((ta: any) => {
      const tag = tagsById.get(ta.tagId);
      if (tag) {
        if (!map.has(ta.clientId)) {
          map.set(ta.clientId, []);
        }
        map.get(ta.clientId)!.push(tag);
      }
    });
    return map;
  }, [tagAssignments, tagsById]);

  // Build client services map for quick lookup (needed for filtering and sorting)
  const clientServicesMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    clientServices.forEach(cs => {
      if (!map.has(cs.clientId)) {
        map.set(cs.clientId, new Set());
      }
      map.get(cs.clientId)!.add(cs.serviceId);
    });
    return map;
  }, [clientServices]);

  const getDaysUntil = (date: Date | string | null) => {
    if (!date) return null;
    try {
      const targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) return null;
      return differenceInDays(targetDate, new Date());
    } catch {
      return null;
    }
  };

  const handleSort = (columnId: string) => {
    if (sortBy === columnId) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(columnId);
      setSortOrder("asc");
    }
  };

  // Filter by search query, tags, services, and days until due
  const filteredClients = useMemo(() => {
    let filtered = clients;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (client) =>
          client.name.toLowerCase().includes(query) ||
          client.companyNumber?.toLowerCase().includes(query)
      );
    }

    // Filter by tags (multi-select)
    if (selectedTags.length > 0) {
      filtered = filtered.filter((client) => {
        const clientTags = clientTagsMap.get(client.id) || [];
        return clientTags.some((tag: any) => selectedTags.includes(tag.id));
      });
    }

    // Filter by services (multi-select) - companies with ANY selected service
    if (selectedServices.length > 0) {
      filtered = filtered.filter((client) => {
        const clientServiceSet = clientServicesMap.get(client.id);
        if (!clientServiceSet) return false;
        return selectedServices.some(serviceId => clientServiceSet.has(serviceId));
      });
    }

    // Filter by days until accounts due
    if (daysUntilDueFilter.length > 0) {
      filtered = filtered.filter((client) => {
        if (!client.nextAccountsDue) return false;
        const daysUntil = getDaysUntil(client.nextAccountsDue);
        if (daysUntil === null) return false;

        return daysUntilDueFilter.some((range) => {
          if (range === "1-10") return daysUntil >= 1 && daysUntil <= 10;
          if (range === "11-31") return daysUntil >= 11 && daysUntil <= 31;
          if (range === "32-60") return daysUntil >= 32 && daysUntil <= 60;
          if (range === "61-90") return daysUntil >= 61 && daysUntil <= 90;
          if (range === "90+") return daysUntil > 90;
          if (range === "overdue") return daysUntil < 0;
          return false;
        });
      });
    }

    return filtered;
  }, [clients, searchQuery, selectedTags, selectedServices, daysUntilDueFilter, clientTagsMap, clientServicesMap]);

  // Sort clients
  const sortedClients = useMemo(() => {
    return [...filteredClients].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // Check if sorting by service column
      if (sortBy.startsWith("service_")) {
        const serviceId = sortBy.replace("service_", "");
        // Convert boolean to number: has service = 1, doesn't have = 0
        aValue = clientServicesMap.get(a.id)?.has(serviceId) ? 1 : 0;
        bValue = clientServicesMap.get(b.id)?.has(serviceId) ? 1 : 0;
      } else {
        switch (sortBy) {
          case "name":
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case "companyNumber":
            aValue = a.companyNumber || "";
            bValue = b.companyNumber || "";
            break;
          case "companyStatus":
            aValue = a.companyStatus || "";
            bValue = b.companyStatus || "";
            break;
          case "csDue":
            aValue = a.confirmationStatementNextDue ? new Date(a.confirmationStatementNextDue).getTime() : 0;
            bValue = b.confirmationStatementNextDue ? new Date(b.confirmationStatementNextDue).getTime() : 0;
            break;
          case "accountsDue":
            aValue = a.nextAccountsDue ? new Date(a.nextAccountsDue).getTime() : 0;
            bValue = b.nextAccountsDue ? new Date(b.nextAccountsDue).getTime() : 0;
            break;
          default:
            return 0;
        }
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredClients, sortBy, sortOrder, clientServicesMap]);

  // Build map of client services with full details including owner
  const clientServicesDetailMap = useMemo(() => {
    const map = new Map<string, Map<string, {service: Service, owner: User | undefined}>>();
    clientServices.forEach(cs => {
      const service = allServices.find(s => s.id === cs.serviceId);
      if (!service) return;
      
      if (!map.has(cs.clientId)) {
        map.set(cs.clientId, new Map());
      }
      
      const owner = allUsers.find(u => u.id === cs.serviceOwnerId);
      map.get(cs.clientId)!.set(service.id, { service, owner });
    });
    return map;
  }, [clientServices, allServices, allUsers]);

  const getDaysUntilBadge = (days: number | null) => {
    if (days === null) return <span className="text-muted-foreground text-xs">—</span>;

    if (days < 0) {
      return (
        <Badge variant="destructive" className="font-mono text-xs">
          {Math.abs(days)}d overdue
        </Badge>
      );
    }

    if (days <= 30) {
      return (
        <Badge className="bg-orange-500 text-white font-mono text-xs">{days}d</Badge>
      );
    }

    if (days <= 60) {
      return (
        <Badge className="bg-yellow-500 text-white font-mono text-xs">{days}d</Badge>
      );
    }

    return (
      <Badge variant="outline" className="font-mono text-xs">
        {days}d
      </Badge>
    );
  };

  const getCompanyStatusBadge = (status: string | null, statusDetail: string | null) => {
    const isStrikeOffProposal = statusDetail === "active-proposal-to-strike-off";

    if (isStrikeOffProposal) {
      return (
        <div className="flex items-center space-x-1">
          <AlertTriangle className="w-3 h-3 text-red-600" />
          <Badge variant="destructive" className="text-xs">Strike-Off</Badge>
        </div>
      );
    }

    if (status === "active") {
      return <Badge className="bg-green-600 text-white text-xs">Active</Badge>;
    }

    if (status === "dissolved") {
      return <Badge variant="outline" className="text-xs">Dissolved</Badge>;
    }

    return <Badge variant="outline" className="text-xs">{status || "Unknown"}</Badge>;
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return "—";
    }
  };

  const renderCellContent = (column: ColumnConfig, client: Client) => {
    switch (column.id) {
      case "checkbox":
        return (
          <Checkbox
            checked={selectedClients.has(client.id)}
            onCheckedChange={(checked) => onSelectClient(client.id, checked as boolean)}
            data-testid={`checkbox-select-${client.id}`}
            aria-label={`Select ${client.name}`}
          />
        );
      case "name":
        return (
          <div className="flex items-center space-x-2">
            <Building className="w-3 h-3 text-muted-foreground" />
            <span className="font-medium text-sm">{client.name}</span>
          </div>
        );
      case "companyNumber":
        return <span className="font-mono text-xs">{client.companyNumber}</span>;
      case "companyStatus":
        return getCompanyStatusBadge(client.companyStatus, client.companyStatusDetail);
      case "tags":
        const clientTags = clientTagsMap.get(client.id) || [];
        return (
          <div className="flex flex-wrap gap-1">
            {clientTags.length > 0 ? (
              clientTags.map((tag: any) => (
                <Badge
                  key={tag.id}
                  style={{ backgroundColor: tag.color }}
                  className="text-white text-xs"
                  data-testid={`tag-${tag.id}-${client.id}`}
                >
                  <Tag className="w-2.5 h-2.5 mr-1" />
                  {tag.name}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        );
      case "hasApp":
        const hasAppCount = portalStatus[client.id]?.hasApp || 0;
        return (
          <div className="flex items-center justify-center space-x-1">
            {hasAppCount > 0 ? (
              <div className="flex items-center gap-0.5">
                {Array.from({ length: Math.min(hasAppCount, 5) }).map((_, i) => (
                  <Check key={i} className="w-3 h-3 text-green-600" data-testid={`check-has-app-${i}-${client.id}`} />
                ))}
                {hasAppCount > 5 && <span className="text-xs text-muted-foreground ml-1">+{hasAppCount - 5}</span>}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        );
      case "pushEnabled":
        const pushEnabledCount = portalStatus[client.id]?.pushEnabled || 0;
        return (
          <div className="flex items-center justify-center space-x-1">
            {pushEnabledCount > 0 ? (
              <div className="flex items-center gap-0.5">
                {Array.from({ length: Math.min(pushEnabledCount, 5) }).map((_, i) => (
                  <Check key={i} className="w-3 h-3 text-blue-600" data-testid={`check-push-enabled-${i}-${client.id}`} />
                ))}
                {pushEnabledCount > 5 && <span className="text-xs text-muted-foreground ml-1">+{pushEnabledCount - 5}</span>}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        );
      case "csDue":
        const csDays = getDaysUntil(client.confirmationStatementNextDue);
        return (
          <div className="flex items-center justify-center space-x-1">
            {getDaysUntilBadge(csDays)}
          </div>
        );
      case "accountsDue":
        const accountsDays = getDaysUntil(client.nextAccountsDue);
        return (
          <div className="flex items-center justify-center space-x-1">
            {getDaysUntilBadge(accountsDays)}
          </div>
        );
      case "csPeriodEnd":
        return <span className="text-xs">{formatDate(client.confirmationStatementNextMadeUpTo)}</span>;
      case "accountsPeriodEnd":
        return <span className="text-xs">{formatDate(client.nextAccountsPeriodEnd)}</span>;
      case "companyType":
        return <span className="text-xs">{client.companyType || "—"}</span>;
      case "dateOfCreation":
        return <span className="text-xs">{formatDate(client.dateOfCreation)}</span>;
      case "jurisdiction":
        return <span className="text-xs">{client.jurisdiction || "—"}</span>;
      case "actions":
        return (
          <Link href={`/clients/${client.id}`}>
            <Button variant="ghost" size="sm" data-testid={`button-view-${client.id}`}>
              <Eye className="w-3 h-3 mr-1" />
              <span className="text-xs">View</span>
            </Button>
          </Link>
        );
      default:
        // Service columns with owner information
        if (column.type === "service") {
          const serviceId = column.id.replace("service_", "");
          const serviceDetails = clientServicesDetailMap.get(client.id)?.get(serviceId);
          
          if (serviceDetails) {
            const { owner } = serviceDetails;
            return (
              <div className="flex flex-col items-center justify-center space-y-0.5">
                <Check className="w-5 h-5 text-green-600 stroke-[2.5]" data-testid={`check-service-${serviceId}-${client.id}`} />
                {owner && (
                  <span className="text-[10px] text-muted-foreground font-medium" data-testid={`owner-${serviceId}-${client.id}`}>
                    {owner.firstName} {owner.lastName}
                  </span>
                )}
              </div>
            );
          }
          return null;
        }
        return null;
    }
  };

  const allSelected = sortedClients.length > 0 && selectedClients.size === sortedClients.length;
  const someSelected = selectedClients.size > 0 && selectedClients.size < sortedClients.length;

  // Get ordered visible columns
  const orderedVisibleColumns = columnOrder
    .filter((colId) => {
      const column = ALL_COLUMNS.find((c) => c.id === colId);
      return column && visibleColumns.includes(colId);
    })
    .map((colId) => ALL_COLUMNS.find((c) => c.id === colId)!)
    .filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Header with Search and Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or company number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 border-2"
              data-testid="input-search-companies"
            />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-column-settings">
                <Settings2 className="w-4 h-4 mr-2" />
                Columns
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-column-settings" className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Column Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                <p className="text-sm text-muted-foreground">
                  Select which columns to display. Drag column headers to reorder them.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-sm mb-2">Company Fields</h4>
                    <div className="space-y-2">
                      {ALL_COLUMNS.filter(
                        (col) => col.id !== "actions" && col.id !== "checkbox" && col.type !== "service"
                      ).map((column) => (
                        <div key={column.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`column-${column.id}`}
                            checked={visibleColumns.includes(column.id)}
                            onCheckedChange={() => toggleColumnVisibility(column.id)}
                            data-testid={`checkbox-column-${column.id}`}
                          />
                          <label
                            htmlFor={`column-${column.id}`}
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            {column.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm mb-2">Service Columns</h4>
                    <div className="space-y-2">
                      {ALL_COLUMNS.filter((col) => col.type === "service").map((column) => (
                        <div key={column.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`column-${column.id}`}
                            checked={visibleColumns.includes(column.id)}
                            onCheckedChange={() => toggleColumnVisibility(column.id)}
                            data-testid={`checkbox-column-${column.id}`}
                          />
                          <label
                            htmlFor={`column-${column.id}`}
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            {column.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          {selectedClients.size > 0 && (
            <>
              <Button
                onClick={onSyncSelected}
                disabled={isSyncing}
                size="sm"
                variant="outline"
                data-testid="button-sync-selected"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                Sync Selected ({selectedClients.size})
              </Button>
              <Button
                onClick={onEnrichSelected}
                disabled={isEnriching}
                size="sm"
                data-testid="button-enrich-selected"
              >
                <Building className={`w-4 h-4 mr-2 ${isEnriching ? "animate-pulse" : ""}`} />
                Enrich from CH ({selectedClients.size})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                  {orderedVisibleColumns.map((column) => (
                    <SortableColumnHeader
                      key={column.id}
                      column={column}
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      onSort={column.sortable ? handleSort : undefined}
                      width={columnWidths[column.id]}
                      onResize={handleColumnResize}
                      allSelected={allSelected}
                      someSelected={someSelected}
                      onSelectAll={onSelectAll}
                      filteredClientIds={sortedClients.map(c => c.id)}
                    />
                  ))}
                </SortableContext>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedClients.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={orderedVisibleColumns.length}
                    className="text-center py-12"
                  >
                    {searchQuery ? (
                      <>
                        <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-muted-foreground mb-2">
                          No Results Found
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          No companies match your search query
                        </p>
                      </>
                    ) : (
                      <>
                        <Building className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-muted-foreground mb-2">
                          No Companies Found
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          No clients with Companies House connections
                        </p>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                sortedClients.map((client) => (
                  <TableRow key={client.id} data-testid={`row-company-${client.id}`}>
                    {orderedVisibleColumns.map((column) => (
                      <TableCell
                        key={column.id}
                        style={{
                          width: columnWidths[column.id]
                            ? `${columnWidths[column.id]}px`
                            : undefined,
                          minWidth: column.minWidth ? `${column.minWidth}px` : undefined,
                        }}
                        className={column.type === "date" || column.type === "service" ? "text-center" : ""}
                      >
                        {renderCellContent(column, client)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </DndContext>
      </div>
    </div>
  );
}
