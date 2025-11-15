import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Filter, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import TopNavigation from "@/components/top-navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import type { TaskInstance } from "@shared/schema";

// Enriched task instance with additional fields from API
interface EnrichedTaskInstance extends TaskInstance {
  clientName: string;
  personName: string | null;
  assignedByName: string | null;
  requestName: string;
  categoryName: string | null;
  categoryId: string | null;
  progress?: {
    total: number;
    completed: number;
    percentage: number;
  } | null;
}

export default function ClientRequests() {
  const { user, isLoading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("");
  const [personFilter, setPersonFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [activePage, setActivePage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  
  // Fetch active requests (not_started + in_progress)
  const { data: activeData, isLoading: activeLoading } = useQuery<{
    data: EnrichedTaskInstance[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
    filterOptions: {
      clients: Array<{ id: string; name: string }>;
      people: Array<{ id: string; name: string }>;
      categories: Array<{ id: string; name: string }>;
    };
  }>({
    queryKey: ["/api/task-instances", "active", activePage, searchTerm, clientFilter, personFilter, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: 'not_started,in_progress',
        page: activePage.toString(),
        limit: '50',
      });
      if (searchTerm) params.append('search', searchTerm);
      if (clientFilter) params.append('clientId', clientFilter);
      if (personFilter) params.append('personId', personFilter);
      if (categoryFilter) params.append('categoryId', categoryFilter);
      
      const response = await fetch(`/api/task-instances?${params}`);
      if (!response.ok) throw new Error("Failed to fetch active requests");
      return response.json();
    },
    enabled: !!user,
  });
  
  // Fetch completed requests (submitted + approved) with pagination
  const { data: completedData, isLoading: completedLoading } = useQuery<{
    data: EnrichedTaskInstance[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
    filterOptions: {
      clients: Array<{ id: string; name: string }>;
      people: Array<{ id: string; name: string }>;
      categories: Array<{ id: string; name: string }>;
    };
  }>({
    queryKey: ["/api/task-instances", "completed", completedPage, searchTerm, clientFilter, personFilter, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: 'submitted,approved',
        page: completedPage.toString(),
        limit: '50',
      });
      if (searchTerm) params.append('search', searchTerm);
      if (clientFilter) params.append('clientId', clientFilter);
      if (personFilter) params.append('personId', personFilter);
      if (categoryFilter) params.append('categoryId', categoryFilter);
      
      const response = await fetch(`/api/task-instances?${params}`);
      if (!response.ok) throw new Error("Failed to fetch completed requests");
      return response.json();
    },
    enabled: !!user,
  });

  // Reset pagination to page 1 when filters change
  useEffect(() => {
    setActivePage(1);
    setCompletedPage(1);
  }, [searchTerm, clientFilter, personFilter, categoryFilter]);

  // Get unique values for filters from backend filterOptions metadata
  const uniqueClients = useMemo(() => {
    const clients = new Map<string, string>();
    activeData?.filterOptions?.clients?.forEach(({ id, name }) => clients.set(id, name));
    completedData?.filterOptions?.clients?.forEach(({ id, name }) => clients.set(id, name));
    return Array.from(clients.entries()).map(([id, name]) => ({ id, name }));
  }, [activeData, completedData]);

  const uniquePeople = useMemo(() => {
    const people = new Map<string, string>();
    activeData?.filterOptions?.people?.forEach(({ id, name }) => people.set(id, name));
    completedData?.filterOptions?.people?.forEach(({ id, name }) => people.set(id, name));
    return Array.from(people.entries()).map(([id, name]) => ({ id, name }));
  }, [activeData, completedData]);

  const uniqueCategories = useMemo(() => {
    const categories = new Map<string, string>();
    activeData?.filterOptions?.categories?.forEach(({ id, name }) => categories.set(id, name));
    completedData?.filterOptions?.categories?.forEach(({ id, name }) => categories.set(id, name));
    return Array.from(categories.entries()).map(([id, name]) => ({ id, name }));
  }, [activeData, completedData]);

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      not_started: { variant: "secondary", label: "Not Started" },
      in_progress: { variant: "default", label: "In Progress" },
      submitted: { variant: "outline", label: "Submitted" },
      approved: { variant: "default", label: "Approved" },
      cancelled: { variant: "destructive", label: "Cancelled" },
    };
    
    const config = variants[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant as any}>{config.label}</Badge>;
  };

  const RequestsTable = ({ requests, isLoading }: { requests: EnrichedTaskInstance[]; isLoading: boolean }) => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      );
    }

    if (requests.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No client requests found</p>
        </div>
      );
    }

    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <TableRow key={request.id} data-testid={`row-request-${request.id}`}>
                <TableCell className="font-medium">{request.requestName}</TableCell>
                <TableCell>{request.categoryName || '-'}</TableCell>
                <TableCell>
                  <Link href={`/clients/${request.clientId}`} className="text-primary hover:underline">
                    {request.clientName}
                  </Link>
                </TableCell>
                <TableCell>{request.personName || '-'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(request.createdAt)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(request.dueDate)}
                </TableCell>
                <TableCell>{getStatusBadge(request.status)}</TableCell>
                <TableCell>
                  {request.status === 'in_progress' && request.progress ? (
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <Progress value={request.progress.percentage} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground">
                        {request.progress.completed}/{request.progress.total} ({request.progress.percentage}%)
                      </span>
                    </div>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/task-instances/${request.id}`}>
                    <Button variant="ghost" size="sm" data-testid={`button-view-${request.id}`}>
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please log in to view client requests</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation user={user} />
      
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="page-container py-6 md:py-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight" data-testid="heading-client-requests">Client Requests</h1>
            <p className="text-meta mt-1">
              Track and manage all client requests assigned to your clients
            </p>
          </div>
        </div>
      </div>

      <div className="page-container py-6 md:py-8 space-y-8">

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search requests..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search"
                  />
                </div>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <Select value={clientFilter || "all"} onValueChange={(val) => setClientFilter(val === "all" ? "" : val)}>
                  <SelectTrigger className="w-[180px]" data-testid="select-client-filter">
                    <SelectValue placeholder="Filter by client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {uniqueClients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={personFilter || "all"} onValueChange={(val) => setPersonFilter(val === "all" ? "" : val)}>
                  <SelectTrigger className="w-[180px]" data-testid="select-person-filter">
                    <SelectValue placeholder="Filter by person" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All People</SelectItem>
                    {uniquePeople.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={categoryFilter || "all"} onValueChange={(val) => setCategoryFilter(val === "all" ? "" : val)}>
                  <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {uniqueCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(searchTerm || clientFilter || personFilter || categoryFilter) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm("");
                      setClientFilter("");
                      setPersonFilter("");
                      setCategoryFilter("");
                    }}
                    data-testid="button-clear-filters"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="active" className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2" data-testid="tabs-requests">
                <TabsTrigger value="active" data-testid="tab-active">
                  Active ({activeData?.pagination.total || 0})
                </TabsTrigger>
                <TabsTrigger value="completed" data-testid="tab-completed">
                  Completed ({completedData?.pagination.total || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="mt-6">
                <RequestsTable requests={activeData?.data || []} isLoading={activeLoading} />
                
                {activeData?.pagination && activeData.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Page {activeData.pagination.page} of {activeData.pagination.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActivePage(p => Math.max(1, p - 1))}
                        disabled={activeData.pagination.page === 1}
                        data-testid="button-prev-page-active"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActivePage(p => p + 1)}
                        disabled={activeData.pagination.page === activeData.pagination.totalPages}
                        data-testid="button-next-page-active"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="completed" className="mt-6">
                <RequestsTable requests={completedData?.data || []} isLoading={completedLoading} />
                
                {completedData?.pagination && completedData.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Page {completedData.pagination.page} of {completedData.pagination.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCompletedPage(p => Math.max(1, p - 1))}
                        disabled={completedData.pagination.page === 1}
                        data-testid="button-prev-page-completed"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCompletedPage(p => p + 1)}
                        disabled={completedData.pagination.page === completedData.pagination.totalPages}
                        data-testid="button-next-page-completed"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
