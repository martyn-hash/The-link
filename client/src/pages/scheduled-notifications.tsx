import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import TopNavigation from "@/components/top-navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { 
  Bell, 
  RefreshCw, 
  X, 
  Mail, 
  MessageSquare, 
  BellRing,
  CalendarClock,
  AlertCircle,
  Calendar,
  List,
  ChevronLeft,
  ChevronRight,
  Filter,
  Building2,
  FolderKanban,
  Layers,
  Clock,
  CalendarDays
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, startOfDay } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ScheduledNotification } from "@shared/schema";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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

type NotificationWithRelations = ScheduledNotification & {
  client?: { id: string; name: string };
  project?: { id: string; description: string; projectTypeId?: string };
  eligibleStageIdsSnapshot?: string[] | null;
  suppressedAt?: Date | null;
  reactivatedAt?: Date | null;
};

export default function ScheduledNotificationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Filter panel state
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [projectTypeFilter, setProjectTypeFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [notificationTypeFilter, setNotificationTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Cancel confirmation dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingNotificationId, setCancellingNotificationId] = useState<string | null>(null);

  // View state
  const [currentView, setCurrentView] = useState<"list" | "calendar">("calendar");
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dateDialogOpen, setDateDialogOpen] = useState(false);

  // Build query params
  const buildQueryParams = () => {
    const params: Record<string, string> = {};
    if (statusFilter !== "all") params.status = statusFilter;
    if (clientFilter !== "all") params.clientId = clientFilter;
    if (projectFilter !== "all") params.projectId = projectFilter;
    if (sourceFilter !== "all") params.dateReference = sourceFilter;
    if (notificationTypeFilter !== "all") params.notificationType = notificationTypeFilter;
    if (dateFrom) params.startDate = format(dateFrom, "yyyy-MM-dd");
    if (dateTo) params.endDate = format(dateTo, "yyyy-MM-dd");
    return params;
  };

  // Fetch notifications with 60s polling interval
  const { data: notifications = [], isLoading, refetch } = useQuery<NotificationWithRelations[]>({
    queryKey: ["/api/scheduled-notifications", buildQueryParams()],
    refetchInterval: 60000,
  });

  // Fetch clients for filter dropdown
  const { data: clients = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch projects for filter dropdown
  const { data: projects = [] } = useQuery<{ id: string; description: string; projectTypeId?: string }[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch project types for filter dropdown (uses non-admin endpoint)
  const { data: projectTypes = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/project-types"],
  });

  // Filter notifications by project type on client side
  const filteredNotifications = notifications.filter(notification => {
    if (projectTypeFilter === "all") return true;
    
    // Find the project and check its project type
    const project = projects.find(p => p.id === notification.projectId);
    return project?.projectTypeId === projectTypeFilter;
  });

  // Individual cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return await apiRequest("POST", `/api/scheduled-notifications/${notificationId}/cancel`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-notifications"] });
      toast({
        title: "Notification cancelled",
        description: "The scheduled notification has been cancelled successfully.",
      });
      setCancelDialogOpen(false);
      setCancellingNotificationId(null);
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  // Bulk cancel mutation
  const bulkCancelMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      return await apiRequest("POST", "/api/scheduled-notifications/bulk-cancel", { notificationIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-notifications"] });
      setSelectedIds(new Set());
      toast({
        title: "Notifications cancelled",
        description: `Successfully cancelled ${selectedIds.size} notification(s).`,
      });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const handleClearFilters = () => {
    setStatusFilter("all");
    setClientFilter("all");
    setProjectFilter("all");
    setProjectTypeFilter("all");
    setSourceFilter("all");
    setNotificationTypeFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const activeFilterCount = () => {
    let count = 0;
    if (statusFilter !== "all") count++;
    if (clientFilter !== "all") count++;
    if (projectFilter !== "all") count++;
    if (projectTypeFilter !== "all") count++;
    if (sourceFilter !== "all") count++;
    if (notificationTypeFilter !== "all") count++;
    if (dateFrom || dateTo) count++;
    return count;
  };

  const handleToggleSelect = (notificationId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(notificationId)) {
      newSelected.delete(notificationId);
    } else {
      newSelected.add(notificationId);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    const scheduledNotifications = filteredNotifications.filter(n => n.status === "scheduled");
    if (selectedIds.size === scheduledNotifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(scheduledNotifications.map(n => n.id)));
    }
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleCancelClick = (notificationId: string) => {
    setCancellingNotificationId(notificationId);
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = () => {
    if (cancellingNotificationId) {
      cancelMutation.mutate(cancellingNotificationId);
    }
  };

  const handleBulkCancel = () => {
    bulkCancelMutation.mutate(Array.from(selectedIds));
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "email":
        return <Mail className="w-4 h-4" />;
      case "sms":
        return <MessageSquare className="w-4 h-4" />;
      case "push":
        return <BellRing className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (notification: NotificationWithRelations) => {
    const { status, eligibleStageIdsSnapshot } = notification;
    
    switch (status) {
      case "scheduled":
        return <Badge variant="default" className="bg-blue-600" data-testid={`badge-status-${status}`}>Scheduled</Badge>;
      case "sent":
        return <Badge variant="default" className="bg-green-600" data-testid={`badge-status-${status}`}>Sent</Badge>;
      case "failed":
        return <Badge variant="destructive" data-testid={`badge-status-${status}`}>Failed</Badge>;
      case "cancelled":
        return <Badge variant="secondary" data-testid={`badge-status-${status}`}>Cancelled</Badge>;
      case "suppressed":
        const hasStageRestriction = eligibleStageIdsSnapshot && eligibleStageIdsSnapshot.length > 0;
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="secondary" 
                  className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 cursor-help" 
                  data-testid={`badge-status-${status}`}
                >
                  Suppressed
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm">
                  {hasStageRestriction 
                    ? "This notification was suppressed because the project moved to a stage where this reminder isn't active."
                    : "This notification was suppressed."}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  May be reactivated if the project moves back to an eligible stage.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      default:
        return <Badge variant="outline" data-testid={`badge-status-${status}`}>{status}</Badge>;
    }
  };

  const getSourceBadge = (notification: NotificationWithRelations) => {
    const isProjectBased = notification.projectId != null;
    
    if (isProjectBased) {
      return (
        <Badge variant="default" className="bg-purple-600" data-testid="badge-source-project">
          <Calendar className="w-3 h-3 mr-1" />
          Project
        </Badge>
      );
    } else {
      return (
        <Badge variant="default" className="bg-orange-600" data-testid="badge-source-service">
          <CalendarClock className="w-3 h-3 mr-1" />
          Service
        </Badge>
      );
    }
  };

  const getContentPreview = (notification: NotificationWithRelations) => {
    let content = "";
    if (notification.emailBody) content = notification.emailBody;
    else if (notification.smsContent) content = notification.smsContent;
    else if (notification.pushTitle && notification.pushBody) content = `${notification.pushTitle} - ${notification.pushBody}`;
    
    const stripped = content.replace(/<[^>]*>/g, "");
    return stripped.length > 50 ? stripped.substring(0, 50) + "..." : stripped;
  };

  const scheduledNotifications = filteredNotifications.filter(n => n.status === "scheduled");
  const hasFiltersApplied = activeFilterCount() > 0;

  // Calendar helper functions
  const generateCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = [];
    let day = startDate;

    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    return days;
  };

  const groupNotificationsByDate = () => {
    const grouped: Record<string, NotificationWithRelations[]> = {};
    
    filteredNotifications.forEach((notification) => {
      if (notification.scheduledFor) {
        const dateKey = format(startOfDay(new Date(notification.scheduledFor)), "yyyy-MM-dd");
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(notification);
      }
    });

    return grouped;
  };

  const getNotificationsForDate = (date: Date) => {
    const dateKey = format(startOfDay(date), "yyyy-MM-dd");
    return groupedNotifications[dateKey] || [];
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
  };

  const handleDateClick = (date: Date) => {
    const notificationsForDate = getNotificationsForDate(date);
    if (notificationsForDate.length > 0) {
      setSelectedDate(date);
      setDateDialogOpen(true);
    }
  };

  const calendarDays = generateCalendarDays();
  const groupedNotifications = groupNotificationsByDate();

  const getTypeColor = (type: string) => {
    switch (type) {
      case "email":
        return "bg-blue-500";
      case "sms":
        return "bg-purple-500";
      case "push":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const getTypeColorClass = (type: string) => {
    switch (type) {
      case "email":
        return "border-l-blue-500";
      case "sms":
        return "border-l-purple-500";
      case "push":
        return "border-l-green-500";
      default:
        return "border-l-gray-500";
    }
  };

  return (
    <>
      <TopNavigation user={user} />
      
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="page-container py-6 md:py-8">
          <Breadcrumb className="mb-4">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Scheduled Notifications</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2" data-testid="text-page-title">
                <CalendarClock className="w-6 h-6 md:w-7 md:h-7" />
                Scheduled Notifications
              </h1>
              <p className="text-meta mt-1">
                Manage upcoming client notifications
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => setFilterPanelOpen(true)} 
                variant="outline"
                data-testid="button-open-filters"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {activeFilterCount() > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                    {activeFilterCount()}
                  </Badge>
                )}
              </Button>
              <Button onClick={() => refetch()} variant="outline" data-testid="button-refresh">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 md:px-6 lg:px-8 py-6 md:py-8 space-y-6">
        {/* Active Filters Display */}
        {hasFiltersApplied && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {statusFilter !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Status: {statusFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setStatusFilter("all")} />
              </Badge>
            )}
            {clientFilter !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Client: {clients.find(c => c.id === clientFilter)?.name || clientFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setClientFilter("all")} />
              </Badge>
            )}
            {projectFilter !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Project: {projects.find(p => p.id === projectFilter)?.description || projectFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setProjectFilter("all")} />
              </Badge>
            )}
            {projectTypeFilter !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Type: {projectTypes.find(pt => pt.id === projectTypeFilter)?.name || projectTypeFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setProjectTypeFilter("all")} />
              </Badge>
            )}
            {sourceFilter !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Source: {sourceFilter === "start_date" ? "Service" : "Project"}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSourceFilter("all")} />
              </Badge>
            )}
            {notificationTypeFilter !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Channel: {notificationTypeFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setNotificationTypeFilter("all")} />
              </Badge>
            )}
            {(dateFrom || dateTo) && (
              <Badge variant="secondary" className="gap-1">
                Date: {dateFrom ? format(dateFrom, "MMM d") : "Start"} - {dateTo ? format(dateTo, "MMM d") : "End"}
                <X className="w-3 h-3 cursor-pointer" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }} />
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-6 text-xs">
              Clear all
            </Button>
          </div>
        )}

        {/* View Toggle */}
        <Tabs value={currentView} onValueChange={(value) => setCurrentView(value as "list" | "calendar")} className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList data-testid="tabs-view-toggle">
              <TabsTrigger value="calendar" data-testid="tab-calendar-view">
                <Calendar className="w-4 h-4 mr-2" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="list" data-testid="tab-list-view">
                <List className="w-4 h-4 mr-2" />
                List
              </TabsTrigger>
            </TabsList>
            
            <div className="text-sm text-muted-foreground">
              {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''} found
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {selectedIds.size > 0 && (
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 mb-6">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium" data-testid="text-selected-count">
                    {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={handleBulkCancel}
                      disabled={bulkCancelMutation.isPending}
                      data-testid="button-bulk-cancel"
                    >
                      <X className="w-4 h-4 mr-2" />
                      {bulkCancelMutation.isPending ? "Cancelling..." : "Cancel Selected"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDeselectAll}
                      data-testid="button-deselect-all"
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Calendar View */}
          <TabsContent value="calendar" className="mt-0">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handlePreviousMonth}
                      data-testid="button-previous-month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <h2 className="text-xl font-semibold min-w-[180px] text-center" data-testid="text-current-month">
                      {format(currentMonth, "MMMM yyyy")}
                    </h2>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleNextMonth}
                      data-testid="button-next-month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleToday}
                      data-testid="button-today"
                    >
                      Today
                    </Button>
                  </div>
                  
                  {/* Legend */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-muted-foreground">Email</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-purple-500" />
                      <span className="text-muted-foreground">SMS</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-muted-foreground">Push</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-1 md:gap-2">
                    {/* Day headers */}
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                      <div
                        key={day}
                        className="text-center font-medium text-sm p-2 text-muted-foreground border-b"
                        data-testid={`text-day-header-${day}`}
                      >
                        {day}
                      </div>
                    ))}
                    
                    {/* Calendar days */}
                    {calendarDays.map((day, idx) => {
                      const dateKey = format(startOfDay(day), "yyyy-MM-dd");
                      const dayNotifications = groupedNotifications[dateKey] || [];
                      const isCurrentMonth = isSameMonth(day, currentMonth);
                      const isToday = isSameDay(day, new Date());
                      
                      const notificationTypes = new Set(dayNotifications.map(n => n.notificationType));
                      const scheduledCount = dayNotifications.filter(n => n.status === "scheduled").length;
                      const sentCount = dayNotifications.filter(n => n.status === "sent").length;
                      const failedCount = dayNotifications.filter(n => n.status === "failed").length;

                      return (
                        <div
                          key={idx}
                          onClick={() => handleDateClick(day)}
                          className={cn(
                            "min-h-[100px] md:min-h-[120px] p-2 border rounded-lg cursor-pointer transition-all",
                            isCurrentMonth ? "bg-background" : "bg-muted/30 text-muted-foreground",
                            isToday ? "ring-2 ring-primary ring-offset-1" : "",
                            dayNotifications.length > 0 ? "hover:bg-accent hover:shadow-md" : "hover:bg-accent/50"
                          )}
                          data-testid={`calendar-day-${dateKey}`}
                        >
                          <div className="flex flex-col h-full">
                            <div className="flex items-center justify-between mb-2">
                              <span className={cn(
                                "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                                isToday ? "bg-primary text-primary-foreground" : ""
                              )}>
                                {format(day, "d")}
                              </span>
                              {dayNotifications.length > 0 && (
                                <Badge
                                  variant="secondary"
                                  className="h-5 px-1.5 text-xs"
                                  data-testid={`badge-count-${dateKey}`}
                                >
                                  {dayNotifications.length}
                                </Badge>
                              )}
                            </div>
                            
                            {dayNotifications.length > 0 && (
                              <div className="flex-1 space-y-1.5">
                                {/* Type indicators */}
                                <div className="flex gap-1 flex-wrap">
                                  {Array.from(notificationTypes).map((type) => (
                                    <div
                                      key={type}
                                      className={cn("w-2.5 h-2.5 rounded-full", getTypeColor(type))}
                                      data-testid={`indicator-${type}-${dateKey}`}
                                      title={type}
                                    />
                                  ))}
                                </div>
                                
                                {/* Status summary */}
                                <div className="text-xs space-y-0.5">
                                  {scheduledCount > 0 && (
                                    <div className="text-blue-600 dark:text-blue-400 font-medium" data-testid={`text-scheduled-${dateKey}`}>
                                      {scheduledCount} scheduled
                                    </div>
                                  )}
                                  {sentCount > 0 && (
                                    <div className="text-green-600 dark:text-green-400" data-testid={`text-sent-${dateKey}`}>
                                      {sentCount} sent
                                    </div>
                                  )}
                                  {failedCount > 0 && (
                                    <div className="text-red-600 dark:text-red-400" data-testid={`text-failed-${dateKey}`}>
                                      {failedCount} failed
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* List View */}
          <TabsContent value="list" className="mt-0">
            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="text-center py-12" data-testid="text-no-notifications">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground text-lg">
                      {hasFiltersApplied 
                        ? "No notifications match your filters" 
                        : "No scheduled notifications found"}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={scheduledNotifications.length > 0 && selectedIds.size === scheduledNotifications.length}
                              onCheckedChange={handleSelectAll}
                              disabled={scheduledNotifications.length === 0}
                              data-testid="checkbox-select-all"
                            />
                          </TableHead>
                          <TableHead>Scheduled For</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Project</TableHead>
                          <TableHead>Channel</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Preview</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredNotifications.map((notification) => (
                          <TableRow 
                            key={notification.id} 
                            data-testid={`row-notification-${notification.id}`}
                            className={cn("border-l-4", getTypeColorClass(notification.notificationType))}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(notification.id)}
                                onCheckedChange={() => handleToggleSelect(notification.id)}
                                disabled={notification.status !== "scheduled"}
                                data-testid={`checkbox-select-${notification.id}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium" data-testid={`text-scheduled-for-${notification.id}`}>
                              {notification.scheduledFor 
                                ? format(new Date(notification.scheduledFor), "MMM d, yyyy HH:mm")
                                : "N/A"}
                            </TableCell>
                            <TableCell data-testid={`text-client-${notification.id}`}>
                              {notification.client?.name || "N/A"}
                            </TableCell>
                            <TableCell data-testid={`text-project-${notification.id}`}>
                              {notification.project?.description || "N/A"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="gap-1" data-testid={`badge-type-${notification.id}`}>
                                {getTypeIcon(notification.notificationType)}
                                {notification.notificationType}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {getSourceBadge(notification)}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(notification)}
                            </TableCell>
                            <TableCell className="max-w-xs" data-testid={`text-content-preview-${notification.id}`}>
                              <span className="text-sm text-muted-foreground">
                                {getContentPreview(notification)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {notification.status === "scheduled" ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancelClick(notification.id)}
                                  data-testid={`button-cancel-${notification.id}`}
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Cancel
                                </Button>
                              ) : (notification.status === "sent" || notification.status === "failed") ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled
                                  data-testid={`button-view-history-${notification.id}`}
                                >
                                  View
                                </Button>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Filter Panel (Slide-out Sheet) */}
      <Sheet open={filterPanelOpen} onOpenChange={setFilterPanelOpen}>
        <SheetContent className="w-[400px] sm:w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filter Notifications
            </SheetTitle>
            <SheetDescription>
              Apply filters to narrow down the notifications displayed.
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
                data-testid="button-clear-all-filters"
              >
                <X className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>

            <Separator />

            {/* Date Range Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                Date Range
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateFrom && "text-muted-foreground"
                        )}
                        data-testid="button-date-from"
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "MMM d, yyyy") : "Start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateTo && "text-muted-foreground"
                        )}
                        data-testid="button-date-to"
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "MMM d, yyyy") : "End date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        disabled={(date) => dateFrom ? date < dateFrom : false}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            <Separator />

            {/* Status Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Status
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="suppressed">Suppressed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Notification Type Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notification Channel
              </Label>
              <Select value={notificationTypeFilter} onValueChange={setNotificationTypeFilter}>
                <SelectTrigger data-testid="select-notification-type-filter">
                  <SelectValue placeholder="All channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All channels</SelectItem>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email
                    </div>
                  </SelectItem>
                  <SelectItem value="sms">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      SMS
                    </div>
                  </SelectItem>
                  <SelectItem value="push">
                    <div className="flex items-center gap-2">
                      <BellRing className="w-4 h-4" />
                      Push
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Source Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Source
              </Label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger data-testid="select-source-filter">
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="start_date">Service-based</SelectItem>
                  <SelectItem value="due_date">Project-based</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Project Type Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4" />
                Project Type
              </Label>
              <Select value={projectTypeFilter} onValueChange={setProjectTypeFilter}>
                <SelectTrigger data-testid="select-project-type-filter">
                  <SelectValue placeholder="All project types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All project types</SelectItem>
                  {projectTypes.map((pt) => (
                    <SelectItem key={pt.id} value={pt.id}>
                      {pt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Client Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Client
              </Label>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger data-testid="select-client-filter">
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Project Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4" />
                Specific Project
              </Label>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger data-testid="select-project-filter">
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Date Details Dialog */}
      <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="dialog-date-details">
          <DialogHeader>
            <DialogTitle>
              Notifications for {selectedDate && format(selectedDate, "MMMM d, yyyy")}
            </DialogTitle>
            <DialogDescription>
              {selectedDate && getNotificationsForDate(selectedDate).length} notification(s) scheduled for this date
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            {selectedDate && getNotificationsForDate(selectedDate).length > 0 ? (
              <div className="space-y-3">
                {getNotificationsForDate(selectedDate).map((notification) => (
                  <Card 
                    key={notification.id} 
                    data-testid={`card-notification-${notification.id}`}
                    className={cn("border-l-4", getTypeColorClass(notification.notificationType))}
                  >
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          {notification.status === "scheduled" && (
                            <Checkbox
                              checked={selectedIds.has(notification.id)}
                              onCheckedChange={() => handleToggleSelect(notification.id)}
                              data-testid={`checkbox-dialog-${notification.id}`}
                            />
                          )}
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="gap-1">
                                {getTypeIcon(notification.notificationType)}
                                {notification.notificationType}
                              </Badge>
                              {getStatusBadge(notification)}
                              <span className="text-sm text-muted-foreground font-medium">
                                {notification.scheduledFor && format(new Date(notification.scheduledFor), "HH:mm")}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {notification.client && (
                                <div>
                                  <span className="text-muted-foreground">Client:</span>{" "}
                                  <span className="font-medium">{notification.client.name}</span>
                                </div>
                              )}
                              
                              {notification.project && (
                                <div>
                                  <span className="text-muted-foreground">Project:</span>{" "}
                                  <span className="font-medium">{notification.project.description}</span>
                                </div>
                              )}
                            </div>
                            
                            <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                              {getContentPreview(notification)}
                            </div>
                          </div>
                        </div>
                        
                        {notification.status === "scheduled" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDateDialogOpen(false);
                              handleCancelClick(notification.id);
                            }}
                            data-testid={`button-dialog-cancel-${notification.id}`}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No notifications for this date
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent data-testid="dialog-cancel-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Notification</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this scheduled notification? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-dialog-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-cancel-dialog-confirm"
            >
              {cancelMutation.isPending ? "Cancelling..." : "Confirm Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
