import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  HelpCircle, 
  Play,
  ChevronDown,
  ChevronRight,
  Calendar,
  RefreshCw,
  FileCheck,
  Clock,
  Check,
  ArrowUpCircle,
  CircleDot,
  ArrowLeft,
  Building2,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import TopNavigation from "@/components/top-navigation";

interface QcCheckResult {
  id: string;
  checkCode: string;
  checkName: string;
  section: string;
  sectionLabel: string;
  status: string;
  statusLabel: string;
  statusColor: string;
  value?: string;
  expected?: string;
  summary: string;
  itemCount: number;
  items: QcResultItem[];
}

interface QcResultItem {
  id: string;
  externalId?: string;
  externalType?: string;
  label: string;
  description?: string;
  amount?: string;
  txnDate?: string;
  approvalStatus: string;
}

interface QcRunDetails {
  id: string;
  clientId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalChecks: number;
  passedChecks: number;
  warningChecks: number;
  failedChecks: number;
  blockedChecks: number;
  score?: number;
  completedAt?: string;
  results: QcCheckResult[];
  triggeredByUser?: { id: string; firstName: string; lastName: string };
}

interface QboConnectionDetail {
  id: string;
  clientId: string;
  realmId: string;
  companyName?: string;
  isActive: boolean;
  client?: {
    id: string;
    name: string;
  };
}

const statusConfig = {
  pass: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50 dark:bg-green-950", border: "border-green-200 dark:border-green-900" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950", border: "border-amber-200 dark:border-amber-900" },
  fail: { icon: XCircle, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950", border: "border-red-200 dark:border-red-900" },
  blocked: { icon: HelpCircle, color: "text-gray-400", bg: "bg-gray-50 dark:bg-gray-950", border: "border-gray-200 dark:border-gray-800" },
};

const approvalStatusConfig = {
  pending: { label: "Pending", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  approved: { label: "Approved", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  escalated: { label: "Escalated", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  resolved: { label: "Resolved", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
};

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export default function QboQcPage() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "escalate" | "resolve">("approve");
  const [selectedItem, setSelectedItem] = useState<QcResultItem | null>(null);
  const [actionNote, setActionNote] = useState("");
  
  const defaultPeriodEnd = endOfMonth(subMonths(new Date(), 1));
  const defaultPeriodStart = startOfMonth(subMonths(new Date(), 1));
  
  const [periodStart, setPeriodStart] = useState<Date>(defaultPeriodStart);
  const [periodEnd, setPeriodEnd] = useState<Date>(defaultPeriodEnd);

  const { data: connection, isLoading: connectionLoading } = useQuery<QboConnectionDetail>({
    queryKey: ["/api/super-admin/qbo-connection", connectionId],
    enabled: !!connectionId && !!user?.superAdmin,
  });

  const clientId = connection?.clientId;

  const { data: summary, isLoading: summaryLoading } = useQuery<{ hasRun: boolean; id?: string; score?: number; completedAt?: string; pendingApprovals?: number }>({
    queryKey: ["/api/qc/summary", clientId],
    enabled: !!clientId,
  });

  const { data: runDetails, isLoading: detailsLoading, refetch: refetchDetails } = useQuery<QcRunDetails>({
    queryKey: ["/api/qc/run", summary?.id],
    enabled: !!summary?.id,
  });

  const runQcMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/qc/run/${clientId}`, {
        periodStart: format(periodStart, "yyyy-MM-dd"),
        periodEnd: format(periodEnd, "yyyy-MM-dd"),
      });
    },
    onSuccess: () => {
      toast({ title: "QC Run Complete", description: "Quality checks have been completed." });
      queryClient.invalidateQueries({ queryKey: ["/api/qc/summary", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/qc/runs", clientId] });
    },
    onError: (error: any) => {
      toast({ 
        title: "QC Run Failed", 
        description: error?.message || "Failed to run quality checks",
        variant: "destructive"
      });
    },
  });

  const itemActionMutation = useMutation({
    mutationFn: async ({ itemId, action, note }: { itemId: string; action: string; note: string }) => {
      return apiRequest("POST", `/api/qc/item/${itemId}/${action}`, { note });
    },
    onSuccess: () => {
      toast({ title: "Item Updated", description: "The item status has been updated." });
      refetchDetails();
      setActionDialogOpen(false);
      setActionNote("");
      setSelectedItem(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Action Failed", 
        description: error?.message || "Failed to update item",
        variant: "destructive"
      });
    },
  });

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const toggleResult = (resultId: string) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(resultId)) {
      newExpanded.delete(resultId);
    } else {
      newExpanded.add(resultId);
    }
    setExpandedResults(newExpanded);
  };

  const handleItemAction = (item: QcResultItem, action: "approve" | "escalate" | "resolve") => {
    setSelectedItem(item);
    setActionType(action);
    setActionDialogOpen(true);
  };

  const submitItemAction = () => {
    if (!selectedItem) return;
    itemActionMutation.mutate({ 
      itemId: selectedItem.id, 
      action: actionType, 
      note: actionNote 
    });
  };

  if (authLoading || connectionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {user && <TopNavigation user={user} />}
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-32 w-full mb-6" />
          <Skeleton className="h-48 w-full" />
        </main>
      </div>
    );
  }

  if (!user?.superAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        {user && <TopNavigation user={user} />}
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You need super admin privileges to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Go to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <TopNavigation user={user} />
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <Card>
            <CardHeader>
              <CardTitle>Connection Not Found</CardTitle>
              <CardDescription>
                The requested QuickBooks connection could not be found.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/super-admin/qbo-connections">
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Connections
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const groupedResults = runDetails?.results?.reduce((acc, result) => {
    if (!acc[result.section]) {
      acc[result.section] = { label: result.sectionLabel, results: [] };
    }
    acc[result.section].results.push(result);
    return acc;
  }, {} as Record<string, { label: string; results: QcCheckResult[] }>);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TopNavigation user={user} />
      
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/super-admin/qbo-connections">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>

        <div className="space-y-6">
          <Card data-testid="card-qc-header">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5" />
                    Quality Control
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Building2 className="h-4 w-4" />
                    <span className="font-medium">{connection.client?.name || "Unknown Client"}</span>
                    <span className="text-muted-foreground">•</span>
                    <span>{connection.companyName || "QuickBooks Online"}</span>
                  </CardDescription>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2" data-testid="button-period-start">
                          <Calendar className="h-4 w-4" />
                          {format(periodStart, "MMM d, yyyy")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={periodStart}
                          onSelect={(date) => date && setPeriodStart(date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <span className="text-muted-foreground">to</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2" data-testid="button-period-end">
                          <Calendar className="h-4 w-4" />
                          {format(periodEnd, "MMM d, yyyy")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <CalendarComponent
                          mode="single"
                          selected={periodEnd}
                          onSelect={(date) => date && setPeriodEnd(date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <Button
                    onClick={() => runQcMutation.mutate()}
                    disabled={runQcMutation.isPending || !clientId}
                    className="gap-2"
                    data-testid="button-run-qc"
                  >
                    {runQcMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Run QC Checks
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {summaryLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !summary?.hasRun ? (
            <Card data-testid="card-qc-no-runs">
              <CardContent className="py-12 text-center">
                <FileCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium text-lg mb-2">No QC Runs Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Select a period and run your first quality check to see results.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card data-testid="card-qc-score">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className={`text-4xl font-bold ${getScoreColor(runDetails?.score || 0)}`}>
                        {runDetails?.score || 0}%
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">Score</div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card data-testid="card-qc-passed">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span className="text-2xl font-bold">{runDetails?.passedChecks || 0}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">Passed</div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card data-testid="card-qc-warnings">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        <span className="text-2xl font-bold">{runDetails?.warningChecks || 0}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">Warnings</div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card data-testid="card-qc-failed">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <XCircle className="h-5 w-5 text-red-500" />
                        <span className="text-2xl font-bold">{runDetails?.failedChecks || 0}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">Failed</div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card data-testid="card-qc-blocked">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <HelpCircle className="h-5 w-5 text-gray-400" />
                        <span className="text-2xl font-bold">{runDetails?.blockedChecks || 0}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">Blocked</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {runDetails?.completedAt && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Last run: {format(new Date(runDetails.completedAt), "MMM d, yyyy 'at' h:mm a")}
                  {runDetails.triggeredByUser && (
                    <span>
                      by {runDetails.triggeredByUser.firstName} {runDetails.triggeredByUser.lastName}
                    </span>
                  )}
                </div>
              )}

              {detailsLoading ? (
                <Skeleton className="h-96 w-full" />
              ) : groupedResults && (
                <Card data-testid="card-qc-results">
                  <CardHeader>
                    <CardTitle>Check Results</CardTitle>
                    <CardDescription>
                      Period: {runDetails?.periodStart && format(new Date(runDetails.periodStart), "MMM d, yyyy")} - {runDetails?.periodEnd && format(new Date(runDetails.periodEnd), "MMM d, yyyy")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(groupedResults).map(([section, { label, results }]) => (
                      <Collapsible
                        key={section}
                        open={expandedSections.has(section)}
                        onOpenChange={() => toggleSection(section)}
                      >
                        <CollapsibleTrigger asChild>
                          <div 
                            className="flex items-center justify-between p-4 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                            data-testid={`section-${section}`}
                          >
                            <div className="flex items-center gap-3">
                              {expandedSections.has(section) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <span className="font-medium">{label}</span>
                              <Badge variant="outline">{results.length} checks</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              {results.filter(r => r.status === 'pass').length > 0 && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  {results.filter(r => r.status === 'pass').length}
                                </Badge>
                              )}
                              {results.filter(r => r.status === 'warning').length > 0 && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  {results.filter(r => r.status === 'warning').length}
                                </Badge>
                              )}
                              {results.filter(r => r.status === 'fail').length > 0 && (
                                <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  {results.filter(r => r.status === 'fail').length}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="space-y-3 pt-3 pl-8">
                            {results.map((result) => {
                              const config = statusConfig[result.status as keyof typeof statusConfig] || statusConfig.blocked;
                              const StatusIcon = config.icon;
                              
                              return (
                                <Collapsible
                                  key={result.id}
                                  open={expandedResults.has(result.id)}
                                  onOpenChange={() => toggleResult(result.id)}
                                >
                                  <div className={`border rounded-lg ${config.border}`}>
                                    <CollapsibleTrigger asChild>
                                      <div 
                                        className={`flex items-center justify-between p-3 cursor-pointer ${config.bg} rounded-t-lg`}
                                        data-testid={`check-${result.checkCode}`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <StatusIcon className={`h-5 w-5 ${config.color}`} />
                                          <div>
                                            <div className="font-medium">{result.checkCode}: {result.checkName}</div>
                                            <div className="text-sm text-muted-foreground">{result.summary}</div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {result.itemCount > 0 && (
                                            <Badge variant="secondary">{result.itemCount} items</Badge>
                                          )}
                                          {expandedResults.has(result.id) ? (
                                            <ChevronDown className="h-4 w-4" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4" />
                                          )}
                                        </div>
                                      </div>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                      <div className="p-4 space-y-4 bg-background">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                          <div>
                                            <span className="text-muted-foreground">Value:</span>
                                            <span className="ml-2 font-medium">{result.value || "N/A"}</span>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground">Expected:</span>
                                            <span className="ml-2 font-medium">{result.expected || "N/A"}</span>
                                          </div>
                                        </div>
                                        
                                        {result.items && result.items.length > 0 && (
                                          <div className="space-y-2">
                                            <h4 className="font-medium text-sm">Items Requiring Attention</h4>
                                            <div className="border rounded-lg divide-y">
                                              {result.items.map((item) => (
                                                <div 
                                                  key={item.id}
                                                  className="p-3 flex items-center justify-between"
                                                  data-testid={`item-${item.id}`}
                                                >
                                                  <div className="flex-1">
                                                    <div className="font-medium">{item.label}</div>
                                                    {item.description && (
                                                      <div className="text-sm text-muted-foreground">{item.description}</div>
                                                    )}
                                                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                                      {item.amount && <span>Amount: ${item.amount}</span>}
                                                      {item.txnDate && (
                                                        <span>Date: {format(new Date(item.txnDate), "MMM d, yyyy")}</span>
                                                      )}
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <Badge 
                                                      className={approvalStatusConfig[item.approvalStatus as keyof typeof approvalStatusConfig]?.color || "bg-gray-100"}
                                                    >
                                                      {approvalStatusConfig[item.approvalStatus as keyof typeof approvalStatusConfig]?.label || item.approvalStatus}
                                                    </Badge>
                                                    {item.approvalStatus === 'pending' && (
                                                      <div className="flex items-center gap-1">
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          className="h-8 w-8 p-0 text-green-600"
                                                          onClick={() => handleItemAction(item, "approve")}
                                                          data-testid={`button-approve-${item.id}`}
                                                        >
                                                          <Check className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          className="h-8 w-8 p-0 text-red-600"
                                                          onClick={() => handleItemAction(item, "escalate")}
                                                          data-testid={`button-escalate-${item.id}`}
                                                        >
                                                          <ArrowUpCircle className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          className="h-8 w-8 p-0 text-blue-600"
                                                          onClick={() => handleItemAction(item, "resolve")}
                                                          data-testid={`button-resolve-${item.id}`}
                                                        >
                                                          <CircleDot className="h-4 w-4" />
                                                        </Button>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </CollapsibleContent>
                                  </div>
                                </Collapsible>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === "approve" && "Approve Item"}
                {actionType === "escalate" && "Escalate Item"}
                {actionType === "resolve" && "Resolve Item"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedItem && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="font-medium">{selectedItem.label}</div>
                  {selectedItem.description && (
                    <div className="text-sm text-muted-foreground">{selectedItem.description}</div>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="action-note">Note (optional)</Label>
                <Textarea
                  id="action-note"
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder={
                    actionType === "approve" ? "Add a note explaining why this is acceptable..." :
                    actionType === "escalate" ? "Add details about why this needs escalation..." :
                    "Add resolution details..."
                  }
                  data-testid="input-action-note"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setActionDialogOpen(false)}
                data-testid="button-cancel-action"
              >
                Cancel
              </Button>
              <Button
                onClick={submitItemAction}
                disabled={itemActionMutation.isPending}
                className={
                  actionType === "approve" ? "bg-green-600 hover:bg-green-700" :
                  actionType === "escalate" ? "bg-red-600 hover:bg-red-700" :
                  "bg-blue-600 hover:bg-blue-700"
                }
                data-testid="button-confirm-action"
              >
                {itemActionMutation.isPending ? "Processing..." :
                  actionType === "approve" ? "Approve" :
                  actionType === "escalate" ? "Escalate" :
                  "Resolve"
                }
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
