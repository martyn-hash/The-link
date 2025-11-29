import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, MessageSquare, BellRing, X, Eye } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, formatDistanceToNow } from "date-fns";
import { NotificationPreviewDialog } from "@/components/NotificationPreviewDialog";

type NotificationWithRelations = {
  id: string;
  category: string;
  notificationTypeLabel: string;
  notificationType: string;
  scheduledFor: string;
  sentAt?: string | null;
  status: string;
  failureReason?: string | null;
  recipient: {
    id: string;
    fullName: string;
    primaryEmail: string | null;
    primaryPhone: string | null;
  } | null;
  projectType: {
    id: string;
    name: string;
  } | null;
  emailTitle?: string | null;
  emailBody?: string | null;
  smsContent?: string | null;
  pushTitle?: string | null;
  pushBody?: string | null;
};

interface ClientNotificationsViewProps {
  clientId: string;
}

export function ClientNotificationsView({ clientId }: ClientNotificationsViewProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"active" | "cancelled" | "sent" | "failed">("active");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Preview dialog state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  
  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [recipientFilter, setRecipientFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Build query params
  const buildQueryParams = () => {
    const params: Record<string, string> = {};
    if (categoryFilter !== "all") params.category = categoryFilter;
    if (typeFilter !== "all") params.type = typeFilter;
    if (recipientFilter !== "all") params.recipientId = recipientFilter;
    if (statusFilter !== "all" && activeTab === "active") params.status = statusFilter;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    
    // Filter by status based on active tab
    if (activeTab === "active") {
      if (!params.status) params.status = "scheduled";
    } else if (activeTab === "cancelled") {
      params.status = "cancelled";
    } else if (activeTab === "sent") {
      params.status = "sent";
    } else if (activeTab === "failed") {
      params.status = "failed";
    }
    
    return params;
  };

  // Fetch notifications
  const queryParams = buildQueryParams();
  const { data: notifications = [], isLoading, refetch } = useQuery<NotificationWithRelations[]>({
    queryKey: [
      "/api/scheduled-notifications/client", 
      clientId, 
      activeTab,
      categoryFilter,
      typeFilter,
      recipientFilter,
      statusFilter,
      dateFrom,
      dateTo
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const queryString = params.toString();
      const url = `/api/scheduled-notifications/client/${clientId}${queryString ? `?${queryString}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return response.json();
    },
  });

  // Get unique recipients for filter dropdown
  const uniqueRecipients = Array.from(
    new Map(
      notifications
        .filter(n => n.recipient)
        .map(n => [n.recipient!.id, n.recipient!])
    ).values()
  );

  // Clear all filters
  const handleClearFilters = () => {
    setCategoryFilter("all");
    setTypeFilter("all");
    setRecipientFilter("all");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  // Toggle selection
  const handleToggleSelect = (notificationId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(notificationId)) {
      newSelected.delete(notificationId);
    } else {
      newSelected.add(notificationId);
    }
    setSelectedIds(newSelected);
  };

  // Select all
  const handleSelectAll = () => {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map(n => n.id)));
    }
  };

  // Bulk cancel mutation
  const bulkCancelMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      return await apiRequest("POST", "/api/scheduled-notifications/bulk-cancel", { notificationIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-notifications/client", clientId] });
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

  const handleBulkCancel = () => {
    bulkCancelMutation.mutate(Array.from(selectedIds));
  };

  // Bulk reactivate mutation
  const bulkReactivateMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      // Call reactivate endpoint for each notification
      const promises = notificationIds.map(id => 
        apiRequest("PATCH", `/api/scheduled-notifications/${id}/reactivate`, {})
      );
      return await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-notifications/client", clientId] });
      setSelectedIds(new Set());
      toast({
        title: "Notifications reactivated",
        description: `Successfully reactivated ${selectedIds.size} notification(s).`,
      });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const handleBulkReactivate = () => {
    bulkReactivateMutation.mutate(Array.from(selectedIds));
  };

  // Preview notification handler
  const handlePreview = async (notificationId: string) => {
    setIsLoadingPreview(true);
    setPreviewOpen(true);
    setPreviewData(null);
    
    try {
      const response = await fetch(`/api/scheduled-notifications/${notificationId}/preview`);
      if (!response.ok) {
        throw new Error('Failed to fetch preview');
      }
      const data = await response.json();
      setPreviewData(data);
    } catch (error) {
      showFriendlyError({ error });
      setPreviewOpen(false);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Get status badge
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

  // Get category badge
  const getCategoryBadge = (category: string) => {
    if (category === "project_notification") {
      return <Badge variant="default" className="bg-purple-600" data-testid="badge-category-project">Project Notification</Badge>;
    } else if (category === "client_request_reminder") {
      return <Badge variant="default" className="bg-orange-600" data-testid="badge-category-reminder">Client Request Reminder</Badge>;
    }
    return <Badge variant="outline" data-testid="badge-category-unknown">{category}</Badge>;
  };

  // Capitalize channel type
  const capitalizeChannel = (channel: string): string => {
    if (channel === "email") return "Email";
    if (channel === "sms") return "SMS";
    if (channel === "push") return "Push";
    return channel;
  };

  // Get type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "email":
        return <Mail className="w-4 h-4" />;
      case "sms":
        return <MessageSquare className="w-4 h-4" />;
      case "push":
        return <BellRing className="w-4 h-4" />;
      default:
        return null;
    }
  };

  // Format relative date
  const formatRelativeDate = (date: string) => {
    const dateObj = new Date(date);
    const now = new Date();
    const distance = formatDistanceToNow(dateObj, { addSuffix: true });
    const formatted = format(dateObj, "dd MMM yyyy");
    return `${formatted} (${distance})`;
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Client Notifications</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(val) => {
          setActiveTab(val as "active" | "cancelled" | "sent" | "failed");
          setSelectedIds(new Set());
        }}>
          <TabsList className="mb-4">
            <TabsTrigger value="active" data-testid="tab-active-notifications">Active</TabsTrigger>
            <TabsTrigger value="cancelled" data-testid="tab-cancelled-notifications">Do Not Send</TabsTrigger>
            <TabsTrigger value="sent" data-testid="tab-sent-notifications">Sent Notifications</TabsTrigger>
            <TabsTrigger value="failed" data-testid="tab-failed-notifications">Failed</TabsTrigger>
          </TabsList>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
            <div>
              <Label htmlFor="category-filter" className="text-xs">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger id="category-filter" data-testid="select-category-filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="project_notification">Project Notification</SelectItem>
                  <SelectItem value="client_request_reminder">Client Request Reminder</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="type-filter" className="text-xs">Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger id="type-filter" data-testid="select-type-filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="push">Push</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="recipient-filter" className="text-xs">Recipient</Label>
              <Select value={recipientFilter} onValueChange={setRecipientFilter}>
                <SelectTrigger id="recipient-filter" data-testid="select-recipient-filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {uniqueRecipients.map(recipient => (
                    <SelectItem key={recipient.id} value={recipient.id}>
                      {recipient.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeTab === "active" && (
              <div>
                <Label htmlFor="status-filter" className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status-filter" data-testid="select-status-filter">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="date-from" className="text-xs">Date From</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                data-testid="input-date-from"
              />
            </div>

            <div>
              <Label htmlFor="date-to" className="text-xs">Date To</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                data-testid="input-date-to"
              />
            </div>

            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={handleClearFilters}
                data-testid="button-clear-filters"
                className="w-full"
              >
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </div>

          {/* Bulk Action Bar */}
          {selectedIds.size > 0 && (
            <div className="bg-muted p-3 rounded-lg mb-4 flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedIds.size} notification{selectedIds.size > 1 ? 's' : ''} selected
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={activeTab === "active" ? handleBulkCancel : handleBulkReactivate}
                disabled={activeTab === "active" ? bulkCancelMutation.isPending : bulkReactivateMutation.isPending}
                data-testid="button-bulk-cancel"
              >
                {activeTab === "active" ? "Do Not Send" : "Reactivate"}
              </Button>
            </div>
          )}

          <TabsContent value="active">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No active notifications found.
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.size === notifications.length && notifications.length > 0}
                          onCheckedChange={handleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Scheduled Date</TableHead>
                      <TableHead>Project Type</TableHead>
                      <TableHead>Status</TableHead>
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
                            data-testid={`checkbox-select-${notification.id}`}
                          />
                        </TableCell>
                        <TableCell>{getCategoryBadge(notification.category)}</TableCell>
                        <TableCell className="text-sm">{capitalizeChannel(notification.notificationType)}</TableCell>
                        <TableCell>
                          {notification.recipient ? (
                            <div>
                              <div className="font-medium">{notification.recipient.fullName}</div>
                              <div className="text-xs text-muted-foreground">
                                {notification.recipient.primaryEmail || notification.recipient.primaryPhone || "-"}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{formatRelativeDate(notification.scheduledFor)}</TableCell>
                        <TableCell className="text-sm">{notification.projectType?.name || "-"}</TableCell>
                        <TableCell>{getStatusBadge(notification.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreview(notification.id)}
                            data-testid={`button-preview-${notification.id}`}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="cancelled">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No cancelled notifications found.
              </div>
            ) : (
              <div className="border rounded-lg opacity-60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.size === notifications.length && notifications.length > 0}
                          onCheckedChange={handleSelectAll}
                          data-testid="checkbox-select-all-cancelled"
                        />
                      </TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Scheduled Date</TableHead>
                      <TableHead>Project Type</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notifications.map((notification) => (
                      <TableRow key={notification.id} data-testid={`row-notification-cancelled-${notification.id}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(notification.id)}
                            onCheckedChange={() => handleToggleSelect(notification.id)}
                            data-testid={`checkbox-select-cancelled-${notification.id}`}
                          />
                        </TableCell>
                        <TableCell>{getCategoryBadge(notification.category)}</TableCell>
                        <TableCell className="text-sm">{capitalizeChannel(notification.notificationType)}</TableCell>
                        <TableCell>
                          {notification.recipient ? (
                            <div>
                              <div className="font-medium">{notification.recipient.fullName}</div>
                              <div className="text-xs text-muted-foreground">
                                {notification.recipient.primaryEmail || notification.recipient.primaryPhone || "-"}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{formatRelativeDate(notification.scheduledFor)}</TableCell>
                        <TableCell className="text-sm">{notification.projectType?.name || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreview(notification.id)}
                            data-testid={`button-preview-cancelled-${notification.id}`}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="sent">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No sent notifications found.
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Sent Date</TableHead>
                      <TableHead>Project Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notifications.map((notification) => (
                      <TableRow key={notification.id} data-testid={`row-notification-sent-${notification.id}`}>
                        <TableCell>{getCategoryBadge(notification.category)}</TableCell>
                        <TableCell className="text-sm">{capitalizeChannel(notification.notificationType)}</TableCell>
                        <TableCell>
                          {notification.recipient ? (
                            <div>
                              <div className="font-medium">{notification.recipient.fullName}</div>
                              <div className="text-xs text-muted-foreground">
                                {notification.recipient.primaryEmail || notification.recipient.primaryPhone || "-"}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{notification.sentAt ? formatRelativeDate(notification.sentAt) : "-"}</TableCell>
                        <TableCell className="text-sm">{notification.projectType?.name || "-"}</TableCell>
                        <TableCell>{getStatusBadge(notification.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreview(notification.id)}
                            data-testid={`button-preview-sent-${notification.id}`}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="failed">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No failed notifications found.
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Scheduled For</TableHead>
                      <TableHead>Project Type</TableHead>
                      <TableHead>Failure Reason</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notifications.map((notification) => (
                      <TableRow key={notification.id} data-testid={`row-notification-failed-${notification.id}`}>
                        <TableCell>{getCategoryBadge(notification.category)}</TableCell>
                        <TableCell className="text-sm">{capitalizeChannel(notification.notificationType)}</TableCell>
                        <TableCell>
                          {notification.recipient ? (
                            <div>
                              <div className="font-medium">{notification.recipient.fullName}</div>
                              <div className="text-xs text-muted-foreground">
                                {notification.recipient.primaryEmail || notification.recipient.primaryPhone || "-"}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{formatRelativeDate(notification.scheduledFor)}</TableCell>
                        <TableCell className="text-sm">{notification.projectType?.name || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="text-xs">
                            {(notification as any).failureReason || "Unknown error"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreview(notification.id)}
                            data-testid={`button-preview-failed-${notification.id}`}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
    
    {/* Preview Dialog */}
    <NotificationPreviewDialog
      open={previewOpen}
      onOpenChange={setPreviewOpen}
      previewData={previewData}
      isLoading={isLoadingPreview}
    />
    </>
  );
}
