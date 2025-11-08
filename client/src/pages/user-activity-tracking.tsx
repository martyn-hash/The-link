import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import TopNavigation from "@/components/top-navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity, Download, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { User, UserActivityTracking } from "@shared/schema";

type ActivityRecord = UserActivityTracking & { user: User };

export default function UserActivityTrackingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string>("all-users");
  const [entityType, setEntityType] = useState<string>("all-types");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Fetch all users for filtering
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch user activity tracking with filters
  const { data: activityRecords = [], isLoading, refetch, error } = useQuery<ActivityRecord[]>({
    queryKey: ["/api/super-admin/user-activity-tracking", { 
      userId: userId !== "all-users" ? userId : undefined,
      entityType: entityType !== "all-types" ? entityType : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined
    }],
    placeholderData: (previousData) => previousData,
  });

  const handleExport = () => {
    const params = new URLSearchParams();
    if (userId && userId !== "all-users") params.set("userId", userId);
    if (entityType && entityType !== "all-types") params.set("entityType", entityType);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    
    window.open(`/api/super-admin/user-activity-tracking/export?${params.toString()}`, "_blank");
    
    toast({
      title: "Export started",
      description: "User activity tracking CSV will download shortly",
    });
  };

  // No client-side filtering needed - all filters are handled by the API
  const filteredRecords = activityRecords;

  const entityTypeOptions = [
    { value: "all-types", label: "All Types" },
    { value: "client", label: "Clients" },
    { value: "person", label: "People" },
    { value: "project", label: "Projects" },
    { value: "communication", label: "Communications" },
  ];

  return (
    <>
      <TopNavigation user={user} />
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Activity className="w-8 h-8" />
            User Activity Tracking
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor what users are viewing across the system
          </p>
        </div>
        <Button onClick={handleExport} data-testid="button-export">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter activity tracking by user, entity type, and date</CardDescription>
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
                  <SelectItem value="all-users">All users</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="entity-type-filter">Entity Type</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger id="entity-type-filter" data-testid="select-entity-type-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {entityTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity Records</CardTitle>
          <CardDescription>{filteredRecords.length} record(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-3 rounded mb-4" data-testid="error-records">
              Failed to load activity records. Please try again.
            </div>
          )}
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-records">
              No activity records found matching filters
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Entity Type</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead>Viewed At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id} data-testid={`row-record-${record.id}`}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {record.user.firstName} {record.user.lastName}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {record.user.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {record.entityType}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {record.entityId}
                      </TableCell>
                      <TableCell>
                        {record.viewedAt 
                          ? format(new Date(record.viewedAt), "MMM d, yyyy HH:mm:ss")
                          : "N/A"}
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
    </>
  );
}
