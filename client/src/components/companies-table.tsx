import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Client, type Service, type ClientService } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
}: {
  column: ColumnConfig;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort?: (columnId: string) => void;
  width?: number;
  onResize?: (columnId: string, width: number) => void;
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
          <span className="text-xs font-medium">
            {column.label}{" "}
            {column.sortable && sortBy === column.id && (sortOrder === "asc" ? "↑" : "↓")}
          </span>
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
  onSelectAll: (checked: boolean) => void;
  onSyncSelected: () => void;
  isSyncing: boolean;
}

export default function CompaniesTable({
  clients,
  selectedClients,
  onSelectClient,
  onSelectAll,
  onSyncSelected,
  isSyncing,
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

  // Build ALL_COLUMNS dynamically including service columns
  const ALL_COLUMNS = useMemo<ColumnConfig[]>(() => {
    const baseColumns: ColumnConfig[] = [
      { id: "checkbox", label: "", defaultVisible: true, minWidth: 50, type: "text" },
      { id: "name", label: "Client Name", sortable: true, defaultVisible: true, minWidth: 200, type: "text" },
      { id: "companyNumber", label: "Company Number", sortable: true, defaultVisible: true, minWidth: 150, type: "text" },
      { id: "companyStatus", label: "Status", sortable: true, defaultVisible: true, minWidth: 150, type: "status" },
      { id: "csDue", label: "CS Due", sortable: true, defaultVisible: true, minWidth: 120, type: "date" },
      { id: "accountsDue", label: "Accounts Due", sortable: true, defaultVisible: true, minWidth: 140, type: "date" },
      { id: "csPeriodEnd", label: "CS Period End", sortable: false, defaultVisible: false, minWidth: 140, type: "date" },
      { id: "accountsPeriodEnd", label: "Accounts Period End", sortable: false, defaultVisible: false, minWidth: 180, type: "date" },
      { id: "companyType", label: "Company Type", sortable: false, defaultVisible: false, minWidth: 150, type: "text" },
      { id: "dateOfCreation", label: "Date of Creation", sortable: false, defaultVisible: false, minWidth: 150, type: "date" },
      { id: "jurisdiction", label: "Jurisdiction", sortable: false, defaultVisible: false, minWidth: 120, type: "text" },
    ];

    // Add service columns
    const serviceColumns: ColumnConfig[] = allServices.map(service => ({
      id: `service_${service.id}`,
      label: service.name,
      sortable: false,
      defaultVisible: false,
      minWidth: 120,
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

  // Apply saved preferences on load, but merge with defaults
  useEffect(() => {
    if (savedPreferences && ALL_COLUMNS.length > 0) {
      if (savedPreferences.columnOrder) {
        // Merge saved order with any new columns that weren't saved yet
        const savedIds = savedPreferences.columnOrder;
        const allCurrentIds = ALL_COLUMNS.map(col => col.id);
        const newIds = allCurrentIds.filter(id => !savedIds.includes(id));
        const actionsIndex = savedIds.indexOf('actions');
        if (newIds.length > 0 && actionsIndex !== -1) {
          const merged = [...savedIds];
          merged.splice(actionsIndex, 0, ...newIds);
          setColumnOrder(merged);
        } else if (newIds.length > 0) {
          setColumnOrder([...savedIds, ...newIds]);
        } else {
          setColumnOrder(savedIds);
        }
      }
      
      if (savedPreferences.visibleColumns) {
        // Merge saved visible columns with any new default-visible columns
        const defaultVisibleIds = ALL_COLUMNS.filter(col => col.defaultVisible).map(col => col.id);
        const savedVisible = savedPreferences.visibleColumns;
        const newDefaultVisible = defaultVisibleIds.filter(id => !savedVisible.includes(id));
        if (newDefaultVisible.length > 0) {
          setVisibleColumns([...savedVisible, ...newDefaultVisible]);
        } else {
          setVisibleColumns(savedVisible);
        }
      }
      
      if (savedPreferences.columnWidths) {
        setColumnWidths(savedPreferences.columnWidths as Record<string, number>);
      }
    }
  }, [savedPreferences, ALL_COLUMNS]);

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
    setVisibleColumns((prev) => {
      const newVisible = prev.includes(columnId)
        ? prev.filter((id) => id !== columnId)
        : [...prev, columnId];
      // Save to backend after toggling
      setTimeout(() => {
        savePreferencesMutation.mutate({
          columnOrder,
          visibleColumns: newVisible,
          columnWidths,
        });
      }, 100);
      return newVisible;
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

  const handleSort = (columnId: string) => {
    if (sortBy === columnId) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(columnId);
      setSortOrder("asc");
    }
  };

  // Filter by search query
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;

    const query = searchQuery.toLowerCase();
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(query) ||
        client.companyNumber?.toLowerCase().includes(query)
    );
  }, [clients, searchQuery]);

  // Sort clients
  const sortedClients = useMemo(() => {
    return [...filteredClients].sort((a, b) => {
      let aValue: any;
      let bValue: any;

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

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredClients, sortBy, sortOrder]);

  // Build client services map for quick lookup
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
        // Service columns
        if (column.type === "service") {
          const serviceId = column.id.replace("service_", "");
          const hasService = clientServicesMap.get(client.id)?.has(serviceId);
          return (
            <div className="flex items-center justify-center">
              {hasService && <Check className="w-4 h-4 text-green-600" data-testid={`check-service-${serviceId}-${client.id}`} />}
            </div>
          );
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
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or company number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-companies"
          />
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
            <Button
              onClick={onSyncSelected}
              disabled={isSyncing}
              size="sm"
              data-testid="button-sync-selected"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
              Sync Selected ({selectedClients.size})
            </Button>
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
