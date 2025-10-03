import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type Client } from "@shared/schema";
import { Link } from "wouter";
import TopNavigation from "@/components/top-navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Building, RefreshCw, AlertTriangle, Calendar, Search, Eye } from "lucide-react";
import { differenceInDays, format } from "date-fns";

export default function Companies() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [syncResults, setSyncResults] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all clients
  const { data: allClients, isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Filter clients with Companies House connections
  const companiesHouseClients = allClients?.filter(client => 
    client.companyNumber
  ) || [];

  // Filter by search query
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return companiesHouseClients;
    
    const query = searchQuery.toLowerCase();
    return companiesHouseClients.filter(client => 
      client.name.toLowerCase().includes(query) ||
      client.companyNumber?.toLowerCase().includes(query)
    );
  }, [companiesHouseClients, searchQuery]);

  // Bulk sync mutation
  const syncMutation = useMutation({
    mutationFn: async (clientIds: string[]) => {
      // Sync each client individually
      const results = {
        successful: [] as string[],
        failed: [] as { clientId: string; error: string }[],
      };

      for (const clientId of clientIds) {
        try {
          await apiRequest("POST", `/api/companies-house/sync/${clientId}`);
          results.successful.push(clientId);
        } catch (error) {
          results.failed.push({
            clientId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      setSyncResults(results);
      setShowSyncDialog(true);
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ch-change-requests/grouped"] });
      setSelectedClients(new Set());
      
      const successCount = results.successful.length;
      const failCount = results.failed.length;
      
      toast({
        title: "Sync Complete",
        description: `Successfully synced ${successCount} client${successCount !== 1 ? 's' : ''}${failCount > 0 ? `, ${failCount} failed` : ''}.`,
        variant: successCount > 0 ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync Companies House data",
        variant: "destructive",
      });
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClients(new Set(filteredClients.map(c => c.id)));
    } else {
      setSelectedClients(new Set());
    }
  };

  const handleSelectClient = (clientId: string, checked: boolean) => {
    const newSelected = new Set(selectedClients);
    if (checked) {
      newSelected.add(clientId);
    } else {
      newSelected.delete(clientId);
    }
    setSelectedClients(newSelected);
  };

  const handleSyncSelected = () => {
    if (selectedClients.size === 0) {
      toast({
        title: "No Clients Selected",
        description: "Please select at least one client to sync.",
        variant: "destructive",
      });
      return;
    }
    syncMutation.mutate(Array.from(selectedClients));
  };

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
    if (days === null) return <span className="text-muted-foreground">—</span>;
    
    if (days < 0) {
      return (
        <Badge variant="destructive" className="font-mono">
          {Math.abs(days)}d overdue
        </Badge>
      );
    }
    
    if (days <= 30) {
      return (
        <Badge className="bg-orange-500 text-white font-mono">
          {days}d
        </Badge>
      );
    }
    
    if (days <= 60) {
      return (
        <Badge className="bg-yellow-500 text-white font-mono">
          {days}d
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="font-mono">
        {days}d
      </Badge>
    );
  };

  const getCompanyStatusBadge = (status: string | null, statusDetail: string | null) => {
    const isStrikeOffProposal = statusDetail === 'active-proposal-to-strike-off';
    
    if (isStrikeOffProposal) {
      return (
        <div className="flex items-center space-x-1">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <Badge variant="destructive">Strike-Off Proposed</Badge>
        </div>
      );
    }
    
    if (status === 'active') {
      return <Badge className="bg-green-600 text-white">Active</Badge>;
    }
    
    if (status === 'dissolved') {
      return <Badge variant="outline">Dissolved</Badge>;
    }
    
    return <Badge variant="outline">{status || 'Unknown'}</Badge>;
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-muted-foreground mb-2">Authentication Required</h1>
          <p className="text-muted-foreground">Please log in to access this page.</p>
        </div>
      </div>
    );
  }

  const allSelected = filteredClients.length > 0 && selectedClients.size === filteredClients.length;
  const someSelected = selectedClients.size > 0 && selectedClients.size < filteredClients.length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
      
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <Building className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold" data-testid="text-page-title">
                  Companies House Clients
                </h1>
                <p className="text-muted-foreground mt-2">
                  Manage clients with Companies House connections and sync their data
                </p>
              </div>
            </div>
            {selectedClients.size > 0 && (
              <Button
                onClick={handleSyncSelected}
                disabled={syncMutation.isPending}
                className="bg-primary hover:bg-primary/90"
                data-testid="button-sync-selected"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                Sync Selected ({selectedClients.size})
              </Button>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Companies House Clients</span>
                <Badge variant="outline" data-testid="text-companies-count">
                  {companiesHouseClients.length} {companiesHouseClients.length === 1 ? 'Company' : 'Companies'}
                </Badge>
              </CardTitle>
              <CardDescription>
                Select clients and sync their Companies House data to detect changes
              </CardDescription>
              <div className="pt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or company number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-companies"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {clientsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4 p-4 border rounded">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-12 w-12 rounded" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-[250px]" />
                        <Skeleton className="h-4 w-[200px]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : companiesHouseClients.length > 0 ? (
                <>
                  {filteredClients.length === 0 ? (
                    <div className="text-center py-12">
                      <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-muted-foreground mb-2">No Results Found</h3>
                      <p className="text-sm text-muted-foreground">
                        No companies match your search query
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={allSelected || someSelected}
                              onCheckedChange={handleSelectAll}
                              data-testid="checkbox-select-all"
                              aria-label="Select all companies"
                            />
                          </TableHead>
                          <TableHead>Client Name</TableHead>
                          <TableHead>Company Number</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">CS Due</TableHead>
                          <TableHead className="text-center">Accounts Due</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredClients.map((client) => {
                      const csDays = getDaysUntil(client.confirmationStatementNextDue);
                      const accountsDays = getDaysUntil(client.nextAccountsDue);
                      
                      return (
                        <TableRow key={client.id} data-testid={`row-company-${client.id}`}>
                          <TableCell>
                            <Checkbox
                              checked={selectedClients.has(client.id)}
                              onCheckedChange={(checked) => handleSelectClient(client.id, checked as boolean)}
                              data-testid={`checkbox-select-${client.id}`}
                              aria-label={`Select ${client.name}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center space-x-2">
                              <Building className="w-4 h-4 text-muted-foreground" />
                              <span>{client.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{client.companyNumber}</span>
                          </TableCell>
                          <TableCell>
                            {getCompanyStatusBadge(client.companyStatus, client.companyStatusDetail)}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <Calendar className="w-3 h-3 text-muted-foreground" />
                              {getDaysUntilBadge(csDays)}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <Calendar className="w-3 h-3 text-muted-foreground" />
                              {getDaysUntilBadge(accountsDays)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/clients/${client.id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                data-testid={`button-view-${client.id}`}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                View
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <Building className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">No Companies Found</h3>
                  <p className="text-sm text-muted-foreground">
                    No clients with Companies House connections
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Sync Results Dialog */}
      <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync Results</DialogTitle>
            <DialogDescription>
              Companies House data synchronization completed
            </DialogDescription>
          </DialogHeader>
          {syncResults && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <RefreshCw className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-green-900">Successfully Synced</span>
                </div>
                <p className="text-sm text-green-700">
                  {syncResults.successful.length} client{syncResults.successful.length !== 1 ? 's' : ''}
                </p>
              </div>

              {syncResults.failed.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="font-medium text-red-900">Failed</span>
                  </div>
                  <div className="space-y-1">
                    {syncResults.failed.map((fail: any, idx: number) => (
                      <p key={idx} className="text-sm text-red-700">
                        Client {fail.clientId}: {fail.error}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={() => setShowSyncDialog(false)}
                className="w-full"
                data-testid="button-close-results"
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
