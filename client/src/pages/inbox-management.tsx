import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import TopNavigation from "@/components/top-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  Inbox,
  Plus,
  Trash2,
  Mail,
  Users,
  RefreshCw,
  Building2,
  Download,
  History,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Inbox as InboxType, User } from "@shared/schema";

const addInboxSchema = z.object({
  emailAddress: z.string().email("Please enter a valid email address"),
  displayName: z.string().optional(),
  inboxType: z.enum(["shared", "user", "department"]),
});

type AddInboxFormData = z.infer<typeof addInboxSchema>;

interface HistoricalImportResult {
  inboxId: string;
  inboxEmail: string;
  inboxSynced: number;
  sentSynced: number;
  matched: number;
  skipped: number;
  errors: string[];
}

interface ImportResponse {
  success: boolean;
  summary: {
    inboxesProcessed: number;
    totalInboxSynced: number;
    totalSentSynced: number;
    totalMatched: number;
    totalErrors: number;
  };
  results: HistoricalImportResult[];
}

export default function InboxManagement() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  // Historical import state
  const [selectedInboxIds, setSelectedInboxIds] = useState<Set<string>>(new Set());
  const [sinceDays, setSinceDays] = useState(90);
  const [maxMessagesPerFolder, setMaxMessagesPerFolder] = useState(500);
  const [importResults, setImportResults] = useState<ImportResponse | null>(null);

  const form = useForm<AddInboxFormData>({
    resolver: zodResolver(addInboxSchema),
    defaultValues: {
      emailAddress: "",
      displayName: "",
      inboxType: "shared",
    },
  });

  const { data: inboxes, isLoading: inboxesLoading } = useQuery<InboxType[]>({
    queryKey: ["/api/inboxes"],
    enabled: !!user?.superAdmin,
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user?.superAdmin,
  });

  const syncInboxesMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/inboxes/sync-users");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inboxes"] });
      toast({
        title: "Success",
        description: "Inboxes synchronized from user emails",
      });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const addInboxMutation = useMutation({
    mutationFn: async (data: AddInboxFormData) => {
      return await apiRequest("POST", "/api/inboxes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inboxes"] });
      toast({
        title: "Success",
        description: "Inbox added successfully",
      });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const deleteInboxMutation = useMutation({
    mutationFn: async (inboxId: string) => {
      return await apiRequest("DELETE", `/api/inboxes/${inboxId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inboxes"] });
      toast({
        title: "Success",
        description: "Inbox removed successfully",
      });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const historicalImportMutation = useMutation({
    mutationFn: async (params: {
      inboxIds: string[];
      sinceDays: number;
      maxMessagesPerFolder: number;
    }) => {
      const response = await apiRequest("POST", "/api/admin/email/historical-import", params);
      return response as ImportResponse;
    },
    onSuccess: (data) => {
      setImportResults(data);
      toast({
        title: "Import Complete",
        description: `Imported ${data.summary.totalInboxSynced + data.summary.totalSentSynced} emails from ${data.summary.inboxesProcessed} inbox(es)`,
      });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const handleToggleInbox = (inboxId: string) => {
    setSelectedInboxIds((prev) => {
      const next = new Set(prev);
      if (next.has(inboxId)) {
        next.delete(inboxId);
      } else {
        next.add(inboxId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!inboxes) return;
    const activeInboxes = inboxes.filter(i => i.isActive);
    if (selectedInboxIds.size === activeInboxes.length) {
      setSelectedInboxIds(new Set());
    } else {
      setSelectedInboxIds(new Set(activeInboxes.map(i => i.id)));
    }
  };

  const handleRunImport = () => {
    if (selectedInboxIds.size === 0) {
      toast({
        title: "No inboxes selected",
        description: "Please select at least one inbox to import",
        variant: "destructive",
      });
      return;
    }
    setImportResults(null);
    historicalImportMutation.mutate({
      inboxIds: Array.from(selectedInboxIds),
      sinceDays,
      maxMessagesPerFolder,
    });
  };

  const handleAddInbox = (data: AddInboxFormData) => {
    addInboxMutation.mutate(data);
  };

  const getLinkedUserName = (userId: string | null) => {
    if (!userId || !users) return null;
    const linkedUser = users.find((u) => u.id === userId);
    return linkedUser ? `${linkedUser.firstName} ${linkedUser.lastName}` : null;
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

  if (!user?.superAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-muted-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">Super admin privileges required to access inbox management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />

      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-page-title">Inbox Management</h1>
              <p className="text-muted-foreground mt-1">
                Manage the global inbox registry and control which email inboxes are available in the system
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => syncInboxesMutation.mutate()}
                disabled={syncInboxesMutation.isPending}
                data-testid="button-sync-inboxes"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncInboxesMutation.isPending ? 'animate-spin' : ''}`} />
                {syncInboxesMutation.isPending ? "Syncing..." : "Sync from Users"}
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-inbox">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Shared Inbox
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Shared Inbox</DialogTitle>
                    <DialogDescription>
                      Add a shared or department inbox to the system. These inboxes can be accessed by users with granted permissions.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleAddInbox)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="emailAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="payroll@growth.accountants"
                                {...field}
                                data-testid="input-inbox-email"
                              />
                            </FormControl>
                            <FormDescription>
                              The email address of the shared inbox in your Microsoft 365 tenant
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="displayName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Display Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Payroll Department"
                                {...field}
                                data-testid="input-inbox-name"
                              />
                            </FormControl>
                            <FormDescription>
                              A friendly name to identify this inbox
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="inboxType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Inbox Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-inbox-type">
                                  <SelectValue placeholder="Select inbox type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="shared">Shared Inbox</SelectItem>
                                <SelectItem value="department">Department</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Categorize this inbox for easier management
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsAddDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={addInboxMutation.isPending}
                          data-testid="button-submit-inbox"
                        >
                          {addInboxMutation.isPending ? "Adding..." : "Add Inbox"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card data-testid="card-inbox-registry">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="w-5 h-5" />
                Inbox Registry
              </CardTitle>
              <CardDescription>
                All email inboxes registered in the system. User inboxes are auto-created, shared inboxes need to be added manually.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inboxesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : inboxes && inboxes.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Inbox</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Linked User</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inboxes.map((inbox) => {
                        const linkedUserName = getLinkedUserName(inbox.linkedUserId);
                        return (
                          <TableRow key={inbox.id} data-testid={`row-inbox-${inbox.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {inbox.inboxType === 'user' ? (
                                  <Mail className="w-4 h-4 text-muted-foreground" />
                                ) : inbox.inboxType === 'department' ? (
                                  <Building2 className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <Users className="w-4 h-4 text-muted-foreground" />
                                )}
                                <div>
                                  <div className="font-medium">
                                    {inbox.displayName || inbox.emailAddress}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {inbox.emailAddress}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={inbox.inboxType === 'user' ? 'default' : inbox.inboxType === 'shared' ? 'secondary' : 'outline'}>
                                {inbox.inboxType}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {linkedUserName ? (
                                <span className="text-sm">{linkedUserName}</span>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={inbox.isActive ? 'default' : 'secondary'} className={inbox.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''}>
                                {inbox.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {inbox.createdAt
                                ? formatDistanceToNow(new Date(inbox.createdAt), { addSuffix: true })
                                : "Unknown"}
                            </TableCell>
                            <TableCell>
                              {inbox.inboxType !== 'user' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteInboxMutation.mutate(inbox.id)}
                                  disabled={deleteInboxMutation.isPending}
                                  data-testid={`button-delete-inbox-${inbox.id}`}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Inbox className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No inboxes registered</h3>
                  <p className="text-sm mb-4">
                    Click "Sync from Users" to auto-create inboxes for existing users, or add shared inboxes manually.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => syncInboxesMutation.mutate()}
                    disabled={syncInboxesMutation.isPending}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${syncInboxesMutation.isPending ? 'animate-spin' : ''}`} />
                    Sync from Users
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Historical Import Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Historical Email Import
              </CardTitle>
              <CardDescription>
                Import historical emails from selected inboxes. This will sync both inbound and outbound emails from Microsoft 365.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Import Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sinceDays">Import emails from last</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="sinceDays"
                      type="number"
                      value={sinceDays}
                      onChange={(e) => setSinceDays(parseInt(e.target.value) || 90)}
                      className="w-24"
                      min={1}
                      max={365}
                      data-testid="input-since-days"
                    />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxMessages">Max emails per folder</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="maxMessages"
                      type="number"
                      value={maxMessagesPerFolder}
                      onChange={(e) => setMaxMessagesPerFolder(parseInt(e.target.value) || 500)}
                      className="w-24"
                      min={10}
                      max={1000}
                      data-testid="input-max-messages"
                    />
                    <span className="text-sm text-muted-foreground">emails</span>
                  </div>
                </div>
              </div>

              {/* Inbox Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Select Inboxes to Import</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    data-testid="button-select-all-inboxes"
                  >
                    {inboxes && selectedInboxIds.size === inboxes.filter(i => i.isActive).length
                      ? "Deselect All"
                      : "Select All Active"}
                  </Button>
                </div>
                
                {inboxesLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : inboxes && inboxes.filter(i => i.isActive).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {inboxes.filter(i => i.isActive).map((inbox) => (
                      <div
                        key={inbox.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedInboxIds.has(inbox.id)
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50"
                        }`}
                        onClick={() => handleToggleInbox(inbox.id)}
                        data-testid={`checkbox-inbox-${inbox.id}`}
                      >
                        <Checkbox
                          checked={selectedInboxIds.has(inbox.id)}
                          onCheckedChange={() => handleToggleInbox(inbox.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {inbox.displayName || inbox.emailAddress}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {inbox.emailAddress}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {inbox.inboxType}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No active inboxes available for import</p>
                  </div>
                )}
              </div>

              {/* Import Button */}
              <div className="flex items-center gap-4">
                <Button
                  onClick={handleRunImport}
                  disabled={historicalImportMutation.isPending || selectedInboxIds.size === 0}
                  data-testid="button-run-import"
                >
                  {historicalImportMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Run Historical Import
                    </>
                  )}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedInboxIds.size} inbox(es) selected
                </span>
              </div>

              {/* Import Progress */}
              {historicalImportMutation.isPending && (
                <div className="space-y-2">
                  <Progress value={undefined} className="h-2" />
                  <p className="text-sm text-muted-foreground text-center">
                    Importing emails... This may take several minutes depending on the number of emails.
                  </p>
                </div>
              )}

              {/* Import Results */}
              {importResults && (
                <div className="space-y-4 p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    {importResults.summary.totalErrors === 0 ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-600" />
                    )}
                    <h4 className="font-semibold">Import Complete</h4>
                  </div>

                  {/* Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded bg-background">
                      <div className="text-2xl font-bold text-primary">
                        {importResults.summary.totalInboxSynced}
                      </div>
                      <div className="text-xs text-muted-foreground">Inbound Emails</div>
                    </div>
                    <div className="text-center p-3 rounded bg-background">
                      <div className="text-2xl font-bold text-primary">
                        {importResults.summary.totalSentSynced}
                      </div>
                      <div className="text-xs text-muted-foreground">Outbound Emails</div>
                    </div>
                    <div className="text-center p-3 rounded bg-background">
                      <div className="text-2xl font-bold text-green-600">
                        {importResults.summary.totalMatched}
                      </div>
                      <div className="text-xs text-muted-foreground">Matched to Clients</div>
                    </div>
                    <div className="text-center p-3 rounded bg-background">
                      <div className={`text-2xl font-bold ${importResults.summary.totalErrors > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {importResults.summary.totalErrors}
                      </div>
                      <div className="text-xs text-muted-foreground">Errors</div>
                    </div>
                  </div>

                  {/* Per-inbox Results */}
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium">Results by Inbox</h5>
                    <div className="space-y-2">
                      {importResults.results.map((result) => (
                        <div
                          key={result.inboxId}
                          className="flex items-center justify-between p-2 rounded bg-background text-sm"
                        >
                          <span className="font-medium truncate">{result.inboxEmail}</span>
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <span>{result.inboxSynced} in</span>
                            <span>{result.sentSynced} out</span>
                            <span className="text-green-600">{result.matched} matched</span>
                            {result.errors.length > 0 && (
                              <span className="text-red-600">{result.errors.length} errors</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
