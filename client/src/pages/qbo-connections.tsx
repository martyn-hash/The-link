import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import TopNavigation from "@/components/top-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Link2, 
  Unlink, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Building2,
  Search,
  Loader2,
  TestTube
} from "lucide-react";
import { Link, useLocation } from "wouter";
import type { Client, QboConnectionWithClient } from "@shared/schema";
import { format, formatDistanceToNow } from "date-fns";

interface QboConnectionDisplay extends Omit<QboConnectionWithClient, 'accessTokenEncrypted' | 'refreshTokenEncrypted'> {
  accessTokenExpired: boolean;
  refreshTokenExpired: boolean;
}

interface QboStatus {
  configured: boolean;
}

export default function QboConnections() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<QboConnectionDisplay | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');
    
    if (success === 'connected') {
      toast({ title: "QuickBooks connected successfully!" });
      window.history.replaceState({}, '', '/super-admin/qbo-connections');
    } else if (error) {
      const errorMessages: Record<string, string> = {
        missing_params: "Missing parameters from QuickBooks",
        invalid_state: "Invalid OAuth state - please try again",
        state_already_used: "This authorization has already been used",
        state_expired: "Authorization expired - please try again",
        realm_already_connected: "This QuickBooks company is already connected to another client",
        callback_failed: "Failed to complete QuickBooks connection",
      };
      showFriendlyError({ error: new Error(errorMessages[error] || error) });
      window.history.replaceState({}, '', '/super-admin/qbo-connections');
    }
  }, [toast]);

  const { data: qboStatus } = useQuery<QboStatus>({
    queryKey: ["/api/quickbooks/status"],
    enabled: isAuthenticated && !!user?.superAdmin,
  });

  const { data: connections = [], isLoading: connectionsLoading } = useQuery<QboConnectionDisplay[]>({
    queryKey: ["/api/super-admin/qbo-connections"],
    enabled: isAuthenticated && !!user?.superAdmin,
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: isAuthenticated && showConnectDialog,
  });

  const connectMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const response = await apiRequest("GET", `/api/quickbooks/connect/${clientId}`);
      return response.json();
    },
    onSuccess: (data: { authUrl: string }) => {
      setShowConnectDialog(false);
      window.location.href = data.authUrl;
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (clientId: string) => {
      return await apiRequest("POST", `/api/quickbooks/disconnect/${clientId}`);
    },
    onSuccess: () => {
      toast({ title: "QuickBooks disconnected successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/qbo-connections"] });
      setShowDisconnectDialog(false);
      setSelectedConnection(null);
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      return await apiRequest("POST", `/api/quickbooks/refresh/${connectionId}`);
    },
    onSuccess: () => {
      toast({ title: "Tokens refreshed successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/qbo-connections"] });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const response = await apiRequest("POST", `/api/quickbooks/test/${connectionId}`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Connection test successful",
        description: `Company: ${data.companyName || data.legalName || 'Unknown'}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/qbo-connections"] });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const connectedClientIds = connections.map(c => c.clientId);
  const availableClients = clients.filter(c => !connectedClientIds.includes(c.id));
  
  const filteredConnections = connections.filter(conn => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      conn.client?.name?.toLowerCase().includes(search) ||
      conn.companyName?.toLowerCase().includes(search) ||
      conn.realmId?.toLowerCase().includes(search)
    );
  });

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user?.superAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You need super admin privileges to access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const getConnectionStatus = (conn: QboConnectionDisplay) => {
    if (conn.refreshTokenExpired) {
      return { label: "Expired", variant: "destructive" as const, icon: XCircle };
    }
    if (conn.accessTokenExpired) {
      return { label: "Needs Refresh", variant: "outline" as const, icon: AlertTriangle };
    }
    if (conn.lastErrorMessage) {
      return { label: "Error", variant: "destructive" as const, icon: XCircle };
    }
    return { label: "Connected", variant: "default" as const, icon: CheckCircle };
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TopNavigation user={user} />
      
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              QuickBooks Connections
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage QuickBooks Online connections for client accounts
            </p>
          </div>
          <Button
            onClick={() => setShowConnectDialog(true)}
            disabled={!qboStatus?.configured}
            data-testid="button-connect-qbo"
          >
            <Link2 className="w-4 h-4 mr-2" />
            Connect Client
          </Button>
        </div>

        {!qboStatus?.configured && (
          <Card className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-amber-800 dark:text-amber-200 text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Configuration Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-amber-700 dark:text-amber-300 text-sm">
                QuickBooks API is not configured. Please add <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">QUICKBOOKS_CLIENT_ID</code> and{" "}
                <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">QUICKBOOKS_CLIENT_SECRET</code> to your environment secrets.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Connected Accounts</CardTitle>
                <CardDescription>
                  {connections.length} QuickBooks {connections.length === 1 ? 'account' : 'accounts'} connected
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search connections..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-connections"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {connectionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredConnections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "No connections match your search" : "No QuickBooks connections yet"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>QBO Company</TableHead>
                    <TableHead>Realm ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead>Connected</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredConnections.map((conn) => {
                    const status = getConnectionStatus(conn);
                    const StatusIcon = status.icon;
                    return (
                      <TableRow key={conn.id} data-testid={`row-connection-${conn.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{conn.client?.name || 'Unknown Client'}</span>
                          </div>
                        </TableCell>
                        <TableCell>{conn.companyName || '-'}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">
                            {conn.realmId}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </Badge>
                          {conn.lastErrorMessage && (
                            <p className="text-xs text-destructive mt-1 max-w-[200px] truncate">
                              {conn.lastErrorMessage}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          {conn.lastSyncAt ? (
                            <span className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(conn.lastSyncAt), { addSuffix: true })}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Never</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {conn.createdAt ? format(new Date(conn.createdAt), 'MMM d, yyyy') : '-'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => testMutation.mutate(conn.id)}
                              disabled={testMutation.isPending}
                              data-testid={`button-test-${conn.id}`}
                            >
                              {testMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <TestTube className="w-4 h-4" />
                              )}
                            </Button>
                            {conn.accessTokenExpired && !conn.refreshTokenExpired && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => refreshMutation.mutate(conn.id)}
                                disabled={refreshMutation.isPending}
                                data-testid={`button-refresh-${conn.id}`}
                              >
                                {refreshMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-4 h-4" />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setSelectedConnection(conn);
                                setShowDisconnectDialog(true);
                              }}
                              data-testid={`button-disconnect-${conn.id}`}
                            >
                              <Unlink className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect QuickBooks Account</DialogTitle>
            <DialogDescription>
              Select a client to connect to their QuickBooks Online account
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select
              value={selectedClient?.id || ""}
              onValueChange={(value) => {
                const client = availableClients.find(c => c.id === value);
                setSelectedClient(client || null);
              }}
            >
              <SelectTrigger data-testid="select-client">
                <SelectValue placeholder="Select a client..." />
              </SelectTrigger>
              <SelectContent>
                {availableClients.length === 0 ? (
                  <SelectItem value="_none" disabled>
                    No available clients
                  </SelectItem>
                ) : (
                  availableClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConnectDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedClient && connectMutation.mutate(selectedClient.id)}
              disabled={!selectedClient || connectMutation.isPending}
              data-testid="button-confirm-connect"
            >
              {connectMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" />
                  Connect to QuickBooks
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect QuickBooks?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect QuickBooks from{" "}
              <strong>{selectedConnection?.client?.name}</strong>. You will need to
              reconnect if you want to sync data again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedConnection && disconnectMutation.mutate(selectedConnection.clientId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-disconnect"
            >
              {disconnectMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                "Disconnect"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
