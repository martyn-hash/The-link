import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Bell, 
  RefreshCw, 
  Play, 
  Clock, 
  Mail, 
  MessageSquare, 
  BellRing,
  Zap,
  Search,
  Filter,
  Send
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

type ScheduledNotification = {
  id: string;
  status: string;
  scheduledFor: string;
  notificationType: string;
  clientId: string;
  projectTypeNotificationId: string | null;
  failureReason: string | null;
  client?: { id: string; name: string };
  projectType?: { id: string; name: string };
};

type ProjectType = {
  id: string;
  name: string;
};

export function NotificationTestingTab() {
  const { toast } = useToast();
  const [selectedProjectTypeId, setSelectedProjectTypeId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState<string>("");

  const { data: projectTypes = [], isLoading: loadingProjectTypes } = useQuery<ProjectType[]>({
    queryKey: ["/api/config/project-types"],
  });

  const { data: notifications = [], isLoading: loadingNotifications, refetch: refetchNotifications } = useQuery<ScheduledNotification[]>({
    queryKey: ["/api/scheduled-notifications", statusFilter, selectedProjectTypeId, searchText],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (selectedProjectTypeId) params.append("projectTypeId", selectedProjectTypeId);
      params.append("limit", "50");
      const url = `/api/scheduled-notifications?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch notifications");
      return response.json();
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (projectTypeId: string) => {
      return await apiRequest("POST", "/api/super-admin/notifications/generate", { projectTypeId });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Notifications Generated",
        description: data.message,
      });
      refetchNotifications();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return await apiRequest("POST", `/api/super-admin/notifications/${notificationId}/reschedule`, { immediate: true });
    },
    onSuccess: () => {
      toast({
        title: "Notification Rescheduled",
        description: "Notification set for immediate processing",
      });
      refetchNotifications();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const processNowMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/super-admin/notifications/process-now", {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "Processing Complete",
        description: data.message,
      });
      refetchNotifications();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "email": return <Mail className="h-4 w-4 text-blue-500" />;
      case "sms": return <MessageSquare className="h-4 w-4 text-green-500" />;
      case "push": return <BellRing className="h-4 w-4 text-orange-500" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Scheduled</Badge>;
      case "sent":
        return <Badge variant="secondary" className="bg-green-100 text-green-700">Sent</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "cancelled":
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      const clientName = (n.client?.name || "").toLowerCase();
      return clientName.includes(searchLower);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Generate Notifications
          </CardTitle>
          <CardDescription>
            Schedule start_date notifications for all client services of a project type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="projectType">Project Type</Label>
              <Select
                value={selectedProjectTypeId}
                onValueChange={setSelectedProjectTypeId}
              >
                <SelectTrigger id="projectType" data-testid="select-project-type">
                  <SelectValue placeholder="Select a project type..." />
                </SelectTrigger>
                <SelectContent>
                  {projectTypes.map((pt) => (
                    <SelectItem key={pt.id} value={pt.id}>
                      {pt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => selectedProjectTypeId && generateMutation.mutate(selectedProjectTypeId)}
              disabled={!selectedProjectTypeId || generateMutation.isPending}
              data-testid="button-generate-notifications"
            >
              {generateMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Generate Notifications
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Scheduled Notifications
              </CardTitle>
              <CardDescription>
                Filter, reschedule, and process notifications
              </CardDescription>
            </div>
            <Button
              onClick={() => processNowMutation.mutate()}
              disabled={processNowMutation.isPending}
              variant="default"
              data-testid="button-process-now"
            >
              {processNowMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Process Due Now
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by client name..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-notifications"
                />
              </div>
            </div>
            <div className="w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={() => refetchNotifications()}
              data-testid="button-refresh-notifications"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {loadingNotifications ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No notifications found</p>
              <p className="text-sm">Try adjusting your filters or generate new notifications</p>
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Scheduled For</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNotifications.map((notification) => (
                    <TableRow key={notification.id} data-testid={`row-notification-${notification.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(notification.notificationType)}
                          <span className="capitalize">{notification.notificationType}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {notification.client?.name || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(notification.scheduledFor), "MMM d, yyyy h:mm a")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getStatusBadge(notification.status)}
                          {notification.failureReason && (
                            <p className="text-xs text-destructive">{notification.failureReason}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(notification.status === "scheduled" || notification.status === "failed") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rescheduleMutation.mutate(notification.id)}
                            disabled={rescheduleMutation.isPending}
                            data-testid={`button-reschedule-${notification.id}`}
                          >
                            <Zap className="h-3 w-3 mr-1" />
                            Set Immediate
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
