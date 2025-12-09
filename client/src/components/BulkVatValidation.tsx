import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  RefreshCw, 
  ArrowRight,
  Building,
  MapPin,
  Clock,
  FileCheck
} from "lucide-react";

interface VatValidationResult {
  clientServiceId: string;
  clientId: string;
  clientName: string;
  serviceName: string;
  vatNumber: string;
  validationResult: {
    isValid: boolean;
    error?: string;
    errorCode?: string;
    bypassed?: boolean;
    companyName?: string;
    hmrcAddress?: string;
    hmrcPostcode?: string;
    validatedAt?: string;
  };
  addressComparison?: {
    hasExistingAddress: boolean;
    existingAddress: string;
    hmrcAddress: string;
    addressesDiffer: boolean;
    requiresApproval: boolean;
  };
}

interface BulkValidationResponse {
  message: string;
  summary: {
    totalProcessed: number;
    valid: number;
    invalid: number;
    bypassed: number;
    addressUpdatesRequired: number;
    autoUpdated: number;
  };
  results: VatValidationResult[];
  hmrcDisabled?: boolean;
  disabledReason?: string;
}

export default function BulkVatValidation() {
  const { toast } = useToast();
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<BulkValidationResponse | null>(null);
  const [showAddressApproval, setShowAddressApproval] = useState(false);
  const [selectedItem, setSelectedItem] = useState<VatValidationResult | null>(null);

  const bulkValidateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/vat/validate-bulk", {}) as BulkValidationResponse;
    },
    onSuccess: (data) => {
      setResults(data);
      setShowResults(true);
      if (data.hmrcDisabled) {
        toast({
          title: "HMRC Validation Unavailable",
          description: data.disabledReason || "VAT validation is currently unavailable.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Bulk VAT Validation Complete",
          description: `Processed ${data.summary.totalProcessed} clients. ${data.summary.valid} valid, ${data.summary.invalid} invalid.`,
        });
      }
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const approveAddressMutation = useMutation({
    mutationFn: async ({ clientServiceId, useHmrcAddress }: { clientServiceId: string; useHmrcAddress: boolean }) => {
      return await apiRequest("POST", "/api/vat/approve-address-update", { clientServiceId, useHmrcAddress });
    },
    onSuccess: (data: any, variables) => {
      toast({
        title: variables.useHmrcAddress ? "Address Updated" : "Existing Address Kept",
        description: data.message,
      });
      setShowAddressApproval(false);
      setSelectedItem(null);
      
      if (results) {
        const updatedResults = results.results.map(r => {
          if (r.clientServiceId === variables.clientServiceId && r.addressComparison) {
            return {
              ...r,
              addressComparison: {
                ...r.addressComparison,
                requiresApproval: false,
              },
            };
          }
          return r;
        });
        setResults({
          ...results,
          results: updatedResults,
          summary: {
            ...results.summary,
            addressUpdatesRequired: Math.max(0, results.summary.addressUpdatesRequired - 1),
          },
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/client-services"] });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const handleAddressApproval = (item: VatValidationResult) => {
    setSelectedItem(item);
    setShowAddressApproval(true);
  };

  const getStatusBadge = (result: VatValidationResult) => {
    if (result.validationResult.bypassed) {
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Bypassed</Badge>;
    }
    if (result.validationResult.isValid) {
      if (result.addressComparison?.requiresApproval) {
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Review Address</Badge>;
      }
      return <Badge variant="default" className="bg-green-600">Valid</Badge>;
    }
    return <Badge variant="destructive">Invalid</Badge>;
  };

  const pendingApprovals = results?.results.filter(r => r.addressComparison?.requiresApproval) || [];
  const validResults = results?.results.filter(r => r.validationResult.isValid && !r.addressComparison?.requiresApproval) || [];
  const invalidResults = results?.results.filter(r => !r.validationResult.isValid && !r.validationResult.bypassed) || [];
  const bypassedResults = results?.results.filter(r => r.validationResult.bypassed) || [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Bulk VAT Validation
          </CardTitle>
          <CardDescription>
            Validate all VAT numbers registered with HMRC and review any address differences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Important</AlertTitle>
            <AlertDescription>
              This will validate all active VAT services with HMRC. The process may take a while due to rate limiting (1 request per second).
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-4">
            <Button
              onClick={() => bulkValidateMutation.mutate()}
              disabled={bulkValidateMutation.isPending}
              data-testid="button-bulk-vat-validate"
            >
              {bulkValidateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Start Bulk Validation
                </>
              )}
            </Button>

            {results && (
              <Button
                variant="outline"
                onClick={() => setShowResults(true)}
                data-testid="button-view-vat-results"
              >
                View Last Results ({results.summary.totalProcessed} processed)
              </Button>
            )}
          </div>

          {bulkValidateMutation.isPending && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Processing... This may take several minutes depending on the number of VAT services.
              </div>
              <Progress value={undefined} className="h-2" />
            </div>
          )}

          {results && !showResults && results.hmrcDisabled && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>HMRC Validation Unavailable</AlertTitle>
              <AlertDescription>
                {results.disabledReason || "VAT validation is currently unavailable."}
              </AlertDescription>
            </Alert>
          )}

          {results && !showResults && !results.hmrcDisabled && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{results.summary.totalProcessed}</div>
                <div className="text-xs text-muted-foreground">Total Processed</div>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{results.summary.valid}</div>
                <div className="text-xs text-green-600">Valid</div>
              </div>
              <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{results.summary.invalid}</div>
                <div className="text-xs text-red-600">Invalid</div>
              </div>
              <div className="text-center p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{results.summary.addressUpdatesRequired}</div>
                <div className="text-xs text-orange-600">Need Review</div>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{results.summary.autoUpdated}</div>
                <div className="text-xs text-blue-600">Auto Updated</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Bulk VAT Validation Results</DialogTitle>
            <DialogDescription>
              Processed {results?.summary.totalProcessed || 0} VAT services
            </DialogDescription>
          </DialogHeader>

          {results && results.hmrcDisabled && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>HMRC Validation Unavailable</AlertTitle>
              <AlertDescription>
                {results.disabledReason || "VAT validation is currently unavailable. Please configure HMRC settings."}
              </AlertDescription>
            </Alert>
          )}

          {results && !results.hmrcDisabled && (
            <div className="flex-1 overflow-hidden">
              <div className="grid grid-cols-5 gap-2 mb-4">
                <div className="text-center p-2 bg-muted rounded">
                  <div className="font-bold">{results.summary.totalProcessed}</div>
                  <div className="text-xs">Total</div>
                </div>
                <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded">
                  <div className="font-bold text-green-600">{results.summary.valid}</div>
                  <div className="text-xs text-green-600">Valid</div>
                </div>
                <div className="text-center p-2 bg-red-50 dark:bg-red-950 rounded">
                  <div className="font-bold text-red-600">{results.summary.invalid}</div>
                  <div className="text-xs text-red-600">Invalid</div>
                </div>
                <div className="text-center p-2 bg-orange-50 dark:bg-orange-950 rounded">
                  <div className="font-bold text-orange-600">{results.summary.addressUpdatesRequired}</div>
                  <div className="text-xs text-orange-600">Review</div>
                </div>
                <div className="text-center p-2 bg-amber-50 dark:bg-amber-950 rounded">
                  <div className="font-bold text-amber-600">{results.summary.bypassed}</div>
                  <div className="text-xs text-amber-600">Bypassed</div>
                </div>
              </div>

              <ScrollArea className="h-[calc(80vh-250px)]">
                {pendingApprovals.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      Address Differences Requiring Review ({pendingApprovals.length})
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Client</TableHead>
                          <TableHead>VAT Number</TableHead>
                          <TableHead>Company Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingApprovals.map((item) => (
                          <TableRow key={item.clientServiceId} data-testid={`row-vat-pending-${item.clientServiceId}`}>
                            <TableCell className="font-medium">{item.clientName}</TableCell>
                            <TableCell className="font-mono text-sm">{item.vatNumber}</TableCell>
                            <TableCell>{item.validationResult.companyName || "-"}</TableCell>
                            <TableCell>{getStatusBadge(item)}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddressApproval(item)}
                                data-testid={`button-review-address-${item.clientServiceId}`}
                              >
                                Review Address
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {invalidResults.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Invalid VAT Numbers ({invalidResults.length})
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Client</TableHead>
                          <TableHead>VAT Number</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invalidResults.map((item) => (
                          <TableRow key={item.clientServiceId} data-testid={`row-vat-invalid-${item.clientServiceId}`}>
                            <TableCell className="font-medium">{item.clientName}</TableCell>
                            <TableCell className="font-mono text-sm">{item.vatNumber}</TableCell>
                            <TableCell className="text-red-600 text-sm">{item.validationResult.error}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {validResults.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Valid VAT Numbers ({validResults.length})
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Client</TableHead>
                          <TableHead>VAT Number</TableHead>
                          <TableHead>Company Name</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validResults.map((item) => (
                          <TableRow key={item.clientServiceId} data-testid={`row-vat-valid-${item.clientServiceId}`}>
                            <TableCell className="font-medium">{item.clientName}</TableCell>
                            <TableCell className="font-mono text-sm">{item.vatNumber}</TableCell>
                            <TableCell>{item.validationResult.companyName || "-"}</TableCell>
                            <TableCell>{getStatusBadge(item)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {bypassedResults.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Bypassed (HMRC Unavailable) ({bypassedResults.length})
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Client</TableHead>
                          <TableHead>VAT Number</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bypassedResults.map((item) => (
                          <TableRow key={item.clientServiceId} data-testid={`row-vat-bypassed-${item.clientServiceId}`}>
                            <TableCell className="font-medium">{item.clientName}</TableCell>
                            <TableCell className="font-mono text-sm">{item.vatNumber}</TableCell>
                            <TableCell>{getStatusBadge(item)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResults(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddressApproval} onOpenChange={setShowAddressApproval}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Address Difference</DialogTitle>
            <DialogDescription>
              The address from HMRC differs from the current address on file. Please choose which address to use.
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building className="h-4 w-4" />
                <span className="font-medium">{selectedItem.clientName}</span>
                <span className="text-muted-foreground">|</span>
                <span className="font-mono">{selectedItem.vatNumber}</span>
              </div>

              {selectedItem.validationResult.companyName && (
                <div className="text-sm">
                  <span className="text-muted-foreground">HMRC Registered Name:</span>{" "}
                  <span className="font-medium">{selectedItem.validationResult.companyName}</span>
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Current Address
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap min-h-[100px]">
                    {selectedItem.addressComparison?.existingAddress || <span className="text-muted-foreground italic">No address on file</span>}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => approveAddressMutation.mutate({ 
                      clientServiceId: selectedItem.clientServiceId, 
                      useHmrcAddress: false 
                    })}
                    disabled={approveAddressMutation.isPending}
                    data-testid="button-keep-existing-address"
                  >
                    Keep Current Address
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="h-4 w-4 text-green-600" />
                    HMRC Address
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg text-sm whitespace-pre-wrap min-h-[100px] border border-green-200 dark:border-green-800">
                    {selectedItem.addressComparison?.hmrcAddress || "-"}
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => approveAddressMutation.mutate({ 
                      clientServiceId: selectedItem.clientServiceId, 
                      useHmrcAddress: true 
                    })}
                    disabled={approveAddressMutation.isPending}
                    data-testid="button-use-hmrc-address"
                  >
                    {approveAddressMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-2" />
                    )}
                    Use HMRC Address
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
