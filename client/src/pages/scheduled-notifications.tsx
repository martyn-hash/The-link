import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import TopNavigation from "@/components/top-navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  ChevronRight
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, startOfDay } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ScheduledNotification } from "@shared/schema";
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
  project?: { id: string; description: string };
};

export default function ScheduledNotificationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all"); // New: filter by notification source
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Cancel confirmation dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingNotificationId, setCancellingNotificationId] = useState<string | null>(null);

  // View state
  const [currentView, setCurrentView] = useState<"list" | "calendar">("list");
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dateDialogOpen, setDateDialogOpen] = useState(false);

  // Build query params
  const buildQueryParams = () => {
    const params: Record<string, string> = {};
    if (statusFilter !== "all") params.status = statusFilter;
    if (clientFilter !== "all") params.clientId = clientFilter;
    if (projectFilter !== "all") params.projectId = projectFilter;
    if (sourceFilter !== "all") params.dateReference = sourceFilter; // New: filter by source type
    if (dateFrom) params.startDate = dateFrom;
    if (dateTo) params.endDate = dateTo;
    return params;
  };

  // Fetch notifications with auto-refresh every 30 seconds
  const { data: notifications = [], isLoading, refetch } = useQuery<NotificationWithRelations[]>({
    queryKey: ["/api/scheduled-notifications", buildQueryParams()],
    refetchInterval: 30000,
  });

  // Fetch clients for filter dropdown
  const { data: clients = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch projects for filter dropdown
  const { data: projects = [] } = useQuery<{ id: string; description: string }[]>({
    queryKey: ["/api/projects"],
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
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to cancel notification. Please try again.",
        variant: "destructive",
      });
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
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to cancel notifications. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleClearFilters = () => {
    setStatusFilter("all");
    setClientFilter("all");
    setProjectFilter("all");
    setSourceFilter("all");
    setDateFrom("");
    setDateTo("");
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
    const scheduledNotifications = notifications.filter(n => n.status === "scheduled");
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Badge variant="default" className="bg-blue-600" data-testid={`badge-status-${status}`}>Scheduled</Badge>;
      case "sent":
        return <Badge variant="default" className="bg-green-600" data-testid={`badge-status-${status}`}>Sent</Badge>;
      case "failed":
        return <Badge variant="destructive" data-testid={`badge-status-${status}`}>Failed</Badge>;
      case "cancelled":
        return <Badge variant="secondary" data-testid={`badge-status-${status}`}>Cancelled</Badge>;
      default:
        return <Badge variant="outline" data-testid={`badge-status-${status}`}>{status}</Badge>;
    }
  };

  const getSourceBadge = (notification: NotificationWithRelations) => {
    // Check if notification has a project or is service-based
    const isProjectBased = notification.projectId != null;
    const isServiceBased = !isProjectBased;
    
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
    
    // Strip HTML tags for preview
    const stripped = content.replace(/<[^>]*>/g, "");
    return stripped.length > 50 ? stripped.substring(0, 50) + "..." : stripped;
  };

  const scheduledNotifications = notifications.filter(n => n.status === "scheduled");
  const hasFiltersApplied = statusFilter !== "all" || clientFilter !== "all" || projectFilter !== "all" || sourceFilter !== "all" || dateFrom || dateTo;

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
    
    notifications.forEach((notification) => {
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
            <Button onClick={() => refetch()} variant="outline" data-testid="button-refresh">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="w-full px-4 md:px-6 lg:px-8 py-6 md:py-8 space-y-8">

        {/* Filters Section */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter notifications by status, client, project, and date range</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status-filter">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status-filter" data-testid="select-status-filter">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="source-filter">Source</Label>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger id="source-filter" data-testid="select-source-filter">
                    <SelectValue placeholder="All sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sources</SelectItem>
                    <SelectItem value="start_date">Service-based</SelectItem>
                    <SelectItem value="due_date">Project-based</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-filter">Client</Label>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger id="client-filter" data-testid="select-client-filter">
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

              <div className="space-y-2">
                <Label htmlFor="project-filter">Project</Label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger id="project-filter" data-testid="select-project-filter">
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

              <div className="space-y-2">
                <Label>Actions</Label>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleClearFilters}
                  data-testid="button-clear-filters"
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date-from">Date From</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  data-testid="input-date-from"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date-to">Date To</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  data-testid="input-date-to"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* View Toggle */}
        <Tabs value={currentView} onValueChange={(value) => setCurrentView(value as "list" | "calendar")} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2" data-testid="tabs-view-toggle">
            <TabsTrigger value="list" data-testid="tab-list-view">
              <List className="w-4 h-4 mr-2" />
              List View
            </TabsTrigger>
            <TabsTrigger value="calendar" data-testid="tab-calendar-view">
              <Calendar className="w-4 h-4 mr-2" />
              Calendar View
            </TabsTrigger>
          </TabsList>

          {/* Bulk Actions Bar */}
          {selectedIds.size > 0 && (
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 mt-6">
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

          {/* List View */}
          <TabsContent value="list" className="mt-6">
            <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>{notifications.length} notification(s) found</CardDescription>
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
            ) : notifications.length === 0 ? (
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
                      <TableHead>Client Name</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Content Preview</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notifications.map((notification) => (
                      <TableRow key={notification.id} data-testid={`row-notification-${notification.id}`}>
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
                          {getStatusBadge(notification.status)}
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
                              View History
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

          {/* Calendar View */}
          <TabsContent value="calendar" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle>Calendar View</CardTitle>
                    <CardDescription>{notifications.length} notification(s) found</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviousMonth}
                      data-testid="button-previous-month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleToday}
                      data-testid="button-today"
                    >
                      Today
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextMonth}
                      data-testid="button-next-month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <span className="font-medium ml-2" data-testid="text-current-month">
                      {format(currentMonth, "MMMM yyyy")}
                    </span>
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
                  <div className="grid grid-cols-7 gap-2">
                    {/* Day headers */}
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                      <div
                        key={day}
                        className="text-center font-semibold text-sm p-2 text-muted-foreground"
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
                          className={`
                            min-h-24 p-2 border rounded-lg cursor-pointer transition-all
                            ${isCurrentMonth ? "bg-background" : "bg-muted/30 text-muted-foreground"}
                            ${isToday ? "ring-2 ring-primary" : ""}
                            ${dayNotifications.length > 0 ? "hover:bg-accent hover:shadow-md" : "hover:bg-accent/50"}
                          `}
                          data-testid={`calendar-day-${dateKey}`}
                        >
                          <div className="flex flex-col h-full">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-sm font-medium ${isToday ? "text-primary font-bold" : ""}`}>
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
                              <div className="flex-1 space-y-1">
                                <div className="flex gap-1 flex-wrap">
                                  {Array.from(notificationTypes).map((type) => (
                                    <div
                                      key={type}
                                      className={`w-2 h-2 rounded-full ${getTypeColor(type)}`}
                                      data-testid={`indicator-${type}-${dateKey}`}
                                      title={type}
                                    />
                                  ))}
                                </div>
                                <div className="text-xs space-y-0.5">
                                  {scheduledCount > 0 && (
                                    <div className="text-blue-600 dark:text-blue-400" data-testid={`text-scheduled-${dateKey}`}>
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
        </Tabs>
      </div>

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
              <div className="space-y-4">
                {getNotificationsForDate(selectedDate).map((notification) => (
                  <Card key={notification.id} data-testid={`card-notification-${notification.id}`}>
                    <CardContent className="pt-6">
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
                              {getStatusBadge(notification.status)}
                              <span className="text-sm text-muted-foreground">
                                {notification.scheduledFor && format(new Date(notification.scheduledFor), "HH:mm")}
                              </span>
                            </div>
                            
                            {notification.client && (
                              <div className="text-sm">
                                <span className="font-medium">Client:</span> {notification.client.name}
                              </div>
                            )}
                            
                            {notification.project && (
                              <div className="text-sm">
                                <span className="font-medium">Project:</span> {notification.project.description}
                              </div>
                            )}
                            
                            <div className="text-sm text-muted-foreground">
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
