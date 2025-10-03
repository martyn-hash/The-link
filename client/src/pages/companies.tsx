import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type Client } from "@shared/schema";
import TopNavigation from "@/components/top-navigation";
import CompaniesTable from "@/components/companies-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building, RefreshCw, AlertTriangle } from "lucide-react";

export default function Companies() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [syncResults, setSyncResults] = useState<any>(null);

  // Fetch all clients
  const { data: allClients, isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Filter clients with Companies House connections (must have company number)
  const companiesHouseClients = allClients?.filter(client => 
    client.companyNumber
  ) || [];

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
    setSelectedClients(checked ? new Set(companiesHouseClients.map(c => c.id)) : new Set());
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

  if (clientsLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopNavigation user={user} />
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
      
      {/* Page Header - Same style as Projects page */}
      <div className="border-b bg-card">
        <div className="px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Building className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold" data-testid="text-page-title">
                Companies House Clients
              </h1>
              <Badge variant="outline" data-testid="text-companies-count">
                {companiesHouseClients.length} {companiesHouseClients.length === 1 ? 'Company' : 'Companies'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Full Width */}
      <main className="flex-1 px-8 py-6">
        {companiesHouseClients.length === 0 ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Building className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-medium text-muted-foreground mb-2">No Companies Found</h3>
              <p className="text-muted-foreground">
                No clients with Companies House connections
              </p>
            </div>
          </div>
        ) : (
          <CompaniesTable
            clients={companiesHouseClients}
            selectedClients={selectedClients}
            onSelectClient={handleSelectClient}
            onSelectAll={handleSelectAll}
            onSyncSelected={handleSyncSelected}
            isSyncing={syncMutation.isPending}
          />
        )}
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
