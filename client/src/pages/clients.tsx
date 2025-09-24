import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { type Client } from "@shared/schema";
import TopNavigation from "@/components/top-navigation";
import ClientSearch from "@/components/client-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CompaniesHouseClientModal } from "@/components/companies-house-client-modal";
import { ClientManagementModal } from "@/components/client-management-modal";
import { AlertCircle, Search, Building2, Mail, Plus, Edit } from "lucide-react";
import { format } from "date-fns";

export default function Clients() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");

  // Parse URL search parameter on mount and location changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    if (searchParam) {
      setSearchTerm(searchParam);
    }
  }, [location]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const { data: clients, isLoading: clientsLoading, error } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: isAuthenticated && !!user,
    retry: false,
  });

  // Redirect to login if not authenticated
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

  // Handle query errors
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

  // Filter clients based on search term
  const filteredClients = clients?.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  // Handle create client
  const handleCreateClient = () => {
    setSelectedClient(null);
    setShowClientModal(true);
  };

  // Handle edit client
  const handleEditClient = (client: Client) => {
    // Navigate to client detail view
    setLocation(`/clients/${client.id}`);
  };

  // Handle modal close
  const handleModalClose = () => {
    setShowClientModal(false);
    setSelectedClient(null);
  };

  // Handle successful client operation
  const handleClientSuccess = () => {
    // The modal will handle closing and cache invalidation
    handleModalClose();
  };

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

  // Access control - only admins and managers can access client management
  if (!user.isAdmin && !user.canSeeAdminMenu) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-muted-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You need admin or manager privileges to access client management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-card">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">Clients</h1>
                <p className="text-muted-foreground">Manage your client relationships</p>
              </div>
              {user?.isAdmin && (
                <Button onClick={handleCreateClient} data-testid="button-create-client">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Client
                </Button>
              )}
            </div>
            
            {/* Search */}
            <ClientSearch 
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search clients..." 
              className="max-w-sm"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {clientsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <div className="flex items-center space-x-4">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Unable to load clients</h3>
              <p className="text-muted-foreground text-center max-w-md">
                There was an issue loading the client list. Please try refreshing the page or contact support if the problem persists.
              </p>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              {searchTerm ? (
                <>
                  <Search className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2" data-testid="text-no-search-results">No clients found</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    No clients match your search for "{searchTerm}". Try adjusting your search terms.
                  </p>
                </>
              ) : (
                <>
                  <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2" data-testid="text-no-clients">No clients yet</h3>
                  <p className="text-muted-foreground text-center max-w-md mb-4">
                    There are no clients in the system yet. Clients will appear here as they are added to the system.
                  </p>
                  {user?.role === 'admin' && (
                    <Button onClick={handleCreateClient} data-testid="button-create-first-client">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Client
                    </Button>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClients.map((client) => (
                <Card key={client.id} className="hover:shadow-md transition-shadow group" data-testid={`card-client-${client.id}`}>
                  <CardHeader>
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate" data-testid={`text-client-name-${client.id}`}>
                          {client.name}
                        </CardTitle>
                        {client.email && (
                          <CardDescription className="flex items-center mt-1">
                            <Mail className="w-3 h-3 mr-1" />
                            <span className="truncate" data-testid={`text-client-email-${client.id}`}>
                              {client.email}
                            </span>
                          </CardDescription>
                        )}
                      </div>
                      {user?.role === 'admin' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClient(client);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid={`button-edit-client-${client.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p data-testid={`text-client-created-${client.id}`}>
                        Created: {client.createdAt ? format(new Date(client.createdAt), "MMM d, yyyy") : "Unknown"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Companies House Client Modal for Creation */}
      <CompaniesHouseClientModal
        open={showClientModal && !selectedClient}
        onOpenChange={setShowClientModal}
        client={null}
        onSuccess={handleClientSuccess}
      />
      
      {/* Original Client Management Modal for Editing */}
      <ClientManagementModal
        open={showClientModal && !!selectedClient}
        onOpenChange={setShowClientModal}
        client={selectedClient}
        onSuccess={handleClientSuccess}
      />
    </div>
  );
}