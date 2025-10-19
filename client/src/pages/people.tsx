import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Person, Client, ClientPerson, ClientPortalUser } from "@shared/schema";
import TopNavigation from "@/components/top-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Search, User, Mail, Plus, Edit, Building2, Columns3, Settings2, GripVertical, Check, Eye } from "lucide-react";
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

function SortableColumnHeader({ column, sortBy, sortOrder, onSort, width, onResize }: {
  column: ColumnConfig;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort?: (columnId: string) => void;
  width?: number;
  onResize?: (columnId: string, width: number) => void;
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

export default function People() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
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
    enabled: isAuthenticated && !!user,
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

  const handleColumnToggle = (columnId: string) => {
    const newVisibleColumns = visibleColumns.includes(columnId)
      ? visibleColumns.filter(id => id !== columnId)
      : [...visibleColumns, columnId];
    
    setVisibleColumns(newVisibleColumns);
    savePreferencesMutation.mutate({
      visibleColumns: newVisibleColumns,
      columnOrder,
      columnWidths,
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = columnOrder.indexOf(active.id as string);
    const newIndex = columnOrder.indexOf(over.id as string);
    const newOrder = arrayMove(columnOrder, oldIndex, newIndex);
    
    setColumnOrder(newOrder);
    savePreferencesMutation.mutate({
      visibleColumns,
      columnOrder: newOrder,
      columnWidths,
    });
  };

  const handleResize = (columnId: string, width: number) => {
    const newWidths = { ...columnWidths, [columnId]: width };
    setColumnWidths(newWidths);
    savePreferencesMutation.mutate({
      visibleColumns,
      columnOrder,
      columnWidths: newWidths,
    });
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

  const { data: people, isLoading: peopleLoading, error } = useQuery<PersonWithPortalStatus[]>({
    queryKey: ["/api/people"],
    enabled: isAuthenticated && !!user,
    retry: false,
  });

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
    if (error && isUnauthorizedError(error)) {
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
  }, [error, toast]);

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

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user.isAdmin && !user.canSeeAdminMenu) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-muted-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You need admin or manager privileges to access people management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border bg-card">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">People</h1>
                <p className="text-muted-foreground">Manage contacts and individuals</p>
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
                        items={columnOrder}
                        strategy={horizontalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {columnOrder.map((columnId) => {
                            const column = ALL_COLUMNS.find(c => c.id === columnId);
                            if (!column || column.id === "actions") return null;

                            const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: columnId });
                            const style = {
                              transform: CSS.Transform.toString(transform),
                              transition,
                            };

                            return (
                              <div
                                key={columnId}
                                ref={setNodeRef}
                                style={style}
                                className="flex items-center space-x-2 p-2 border rounded hover:bg-muted/50"
                              >
                                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
                                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <Checkbox
                                  checked={visibleColumns.includes(columnId)}
                                  onCheckedChange={() => handleColumnToggle(columnId)}
                                  data-testid={`checkbox-column-${columnId}`}
                                />
                                <label className="flex-1 text-sm cursor-pointer">{column.label}</label>
                              </div>
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            
            <div className="relative max-w-sm">
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
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
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
          ) : error ? (
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
                  <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
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
        </div>
      </div>
    </div>
  );
}
