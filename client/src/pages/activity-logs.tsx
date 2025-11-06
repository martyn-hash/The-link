import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity, Download, RefreshCw, LogOut } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserSession, User, LoginAttempt } from "@shared/schema";

export default function ActivityLogsPage() {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string>("");
  const [onlyActive, setOnlyActive] = useState<string>("all");
  const [platform, setPlatform] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedTab, setSelectedTab] = useState<"sessions" | "attempts">("sessions");

  // Fetch all users for filtering
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch activity logs with filters
  const { data: sessions = [], isLoading: sessionsLoading, refetch: refetchSessions, error: sessionsError } = useQuery<UserSession[]>({
    queryKey: ["/api/super-admin/activity-logs", { userId, onlyActive: onlyActive !== "all" ? onlyActive : undefined }],
    enabled: selectedTab === "sessions",
  });

  // Fetch login attempts
  const { data: loginAttempts = [], isLoading: attemptsLoading, refetch: refetchAttempts, error: attemptsError } = useQuery<LoginAttempt[]>({
    queryKey: ["/api/super-admin/login-attempts", { userId }],
    enabled: selectedTab === "attempts",
  });

  const handleExport = () => {
    const params = new URLSearchParams();
    if (userId) params.set("userId", userId);
    if (onlyActive !== "all") params.set("onlyActive", onlyActive);
    if (platform) params.set("platform", platform);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    
    window.open(`/api/super-admin/activity-logs/export?${params.toString()}`, "_blank");
    
    toast({
      title: "Export started",
      description: "Activity logs CSV will download shortly",
    });
  };

  const handleLogoutSession = async (sessionId: string) => {
    try {
      await apiRequest("POST", `/api/super-admin/sessions/${sessionId}/logout`);
      
      toast({
        title: "Session logged out",
        description: "User session has been terminated",
      });
      
      await queryClient.invalidateQueries({ queryKey: ["/api/super-admin/activity-logs"] });
      refetchSessions();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout session",
        variant: "destructive",
      });
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "N/A";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  // Apply client-side filters for platform and date range
  const filteredSessions = sessions.filter((session: any) => {
    // Platform filter
    if (platform && session.platformType?.toLowerCase() !== platform.toLowerCase()) {
      return false;
    }
    
    // Date range filter
    if (dateFrom) {
      const loginDate = new Date(session.loginTime);
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      if (loginDate < fromDate) return false;
    }
    
    if (dateTo) {
      const loginDate = new Date(session.loginTime);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (loginDate > toDate) return false;
    }
    
    return true;
  });

  const filteredLoginAttempts = loginAttempts.filter((attempt: any) => {
    // Date range filter
    if (dateFrom) {
      const attemptDate = new Date(attempt.timestamp);
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      if (attemptDate < fromDate) return false;
    }
    
    if (dateTo) {
      const attemptDate = new Date(attempt.timestamp);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (attemptDate > toDate) return false;
    }
    
    return true;
  });

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Activity className="w-8 h-8" />
            Activity Logs
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor user sessions and login activity
          </p>
        </div>
        {selectedTab === "sessions" && (
          <Button onClick={handleExport} data-testid="button-export">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter activity logs by user and status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="user-filter">User</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger id="user-filter" data-testid="select-user-filter">
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All users</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={onlyActive} onValueChange={setOnlyActive}>
                <SelectTrigger id="status-filter" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sessions</SelectItem>
                  <SelectItem value="true">Active only</SelectItem>
                  <SelectItem value="false">Inactive only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="platform-filter">Platform</Label>
              <Select 
                value={platform} 
                onValueChange={setPlatform}
                disabled={selectedTab === "attempts"}
              >
                <SelectTrigger id="platform-filter" data-testid="select-platform-filter">
                  <SelectValue placeholder={selectedTab === "attempts" ? "N/A for attempts" : "All platforms"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All platforms</SelectItem>
                  <SelectItem value="desktop">Desktop</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="tablet">Tablet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            <div className="space-y-2">
              <Label htmlFor="view-type">View</Label>
              <Select value={selectedTab} onValueChange={(v) => setSelectedTab(v as "sessions" | "attempts")}>
                <SelectTrigger id="view-type" data-testid="select-view-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sessions">Sessions</SelectItem>
                  <SelectItem value="attempts">Login Attempts</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => selectedTab === "sessions" ? refetchSessions() : refetchAttempts()}
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedTab === "sessions" && (
        <Card>
          <CardHeader>
            <CardTitle>User Sessions</CardTitle>
            <CardDescription>{filteredSessions.length} session(s) found</CardDescription>
          </CardHeader>
          <CardContent>
            {sessionsError && (
              <div className="bg-destructive/10 text-destructive px-4 py-3 rounded mb-4" data-testid="error-sessions">
                Failed to load sessions. Please try again.
              </div>
            )}
            {sessionsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-sessions">
                No sessions found matching filters
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Login Time</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Browser/Device</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.map((session: any) => (
                      <TableRow key={session.id} data-testid={`row-session-${session.id}`}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {session.user.firstName} {session.user.lastName}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {session.user.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(session.loginTime), "MMM d, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          {session.lastActivity 
                            ? format(new Date(session.lastActivity), "MMM d, yyyy HH:mm")
                            : "N/A"}
                        </TableCell>
                        <TableCell>{formatDuration(session.sessionDuration)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col text-sm">
                            <span>{session.browser || "Unknown"}</span>
                            <span className="text-muted-foreground">
                              {session.device || "Unknown"} • {session.os || "Unknown"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-sm">
                            <span>{session.city || "Unknown"}</span>
                            <span className="text-muted-foreground">
                              {session.country || "Unknown"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {session.ipAddress}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{session.platformType || "Unknown"}</Badge>
                        </TableCell>
                        <TableCell>
                          {session.isActive ? (
                            <Badge variant="default" className="bg-green-600">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {session.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleLogoutSession(session.id)}
                              data-testid={`button-logout-${session.id}`}
                            >
                              <LogOut className="w-4 h-4" />
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
      )}

      {selectedTab === "attempts" && (
        <Card>
          <CardHeader>
            <CardTitle>Login Attempts</CardTitle>
            <CardDescription>{filteredLoginAttempts.length} attempt(s) found</CardDescription>
          </CardHeader>
          <CardContent>
            {attemptsError && (
              <div className="bg-destructive/10 text-destructive px-4 py-3 rounded mb-4" data-testid="error-attempts">
                Failed to load login attempts. Please try again.
              </div>
            )}
            {attemptsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredLoginAttempts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-attempts">
                No login attempts found matching filters
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Failure Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLoginAttempts.map((attempt) => (
                      <TableRow key={attempt.id} data-testid={`row-attempt-${attempt.id}`}>
                        <TableCell>
                          {format(new Date(attempt.timestamp), "MMM d, yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell>{attempt.email}</TableCell>
                        <TableCell className="font-mono text-sm">{attempt.ipAddress}</TableCell>
                        <TableCell>
                          {attempt.success ? (
                            <Badge variant="default" className="bg-green-600">Success</Badge>
                          ) : (
                            <Badge variant="destructive">Failed</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {attempt.failureReason || "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
