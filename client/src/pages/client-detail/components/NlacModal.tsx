import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, History, UserX, UserCheck, Loader2, Eye, EyeOff, Clock, User, ChevronRight, X, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import type { Client, NlacAuditLog } from "@shared/schema";

const NLAC_REASONS = [
  { value: "moving_to_new_accountant", label: "Moving to new accountant" },
  { value: "ceasing_trading", label: "Ceasing trading" },
  { value: "no_longer_using_accountant", label: "No longer using an accountant" },
  { value: "taking_accounts_in_house", label: "Taking accounts in house" },
  { value: "other", label: "Other" },
  { value: "reactivated", label: "Client reactivated" },
] as const;

type NlacReason = typeof NLAC_REASONS[number]["value"];

interface NlacModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client;
}

export function NlacModal({ open, onOpenChange, client }: NlacModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("action");
  const [showConfirmForm, setShowConfirmForm] = useState(false);
  const [showReactivateConfirm, setShowReactivateConfirm] = useState(false);
  const [selectedReason, setSelectedReason] = useState<NlacReason | "">("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const isClientInactive = client.companyStatus === 'inactive';

  const { data: auditLogs = [], isLoading: logsLoading } = useQuery<NlacAuditLog[]>({
    queryKey: [`/api/clients/${client.id}/nlac-logs`],
    enabled: open && activeTab === "history",
  });

  const nlacMutation = useMutation({
    mutationFn: async (data: { reason: NlacReason; password: string }) => {
      return await apiRequest("POST", `/api/clients/${client.id}/nlac`, data);
    },
    onSuccess: (response: any) => {
      const parts = [];
      if (response.projectsDeactivated > 0) parts.push(`${response.projectsDeactivated} projects`);
      if (response.servicesDeactivated > 0) parts.push(`${response.servicesDeactivated} services`);
      if (response.portalUsersDeactivated > 0) parts.push(`${response.portalUsersDeactivated} portal users`);
      const deactivatedText = parts.length > 0 ? ` ${parts.join(', ')} deactivated.` : '';
      toast({
        title: "Client marked as inactive",
        description: `${client.name} has been marked as No Longer a Client.${deactivatedText}`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${client.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${client.id}/nlac-logs`] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      resetAndClose();
    },
    onError: (error: any) => {
      if (error.message?.includes("password")) {
        setPasswordError(error.message);
      } else {
        toast({
          title: "Failed to mark client as inactive",
          description: error.message || "An error occurred while processing the NLAC request.",
          variant: "destructive",
        });
      }
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/clients/${client.id}/reactivate`, {});
    },
    onSuccess: () => {
      toast({
        title: "Client reactivated",
        description: `${client.name} has been reactivated successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${client.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${client.id}/nlac-logs`] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      resetAndClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to reactivate client",
        description: error.message || "An error occurred while reactivating the client.",
        variant: "destructive",
      });
    },
  });

  const resetAndClose = () => {
    setShowConfirmForm(false);
    setShowReactivateConfirm(false);
    setSelectedReason("");
    setPassword("");
    setPasswordError("");
    setShowPassword(false);
    onOpenChange(false);
  };

  const handleInitiateNlac = () => {
    setShowConfirmForm(true);
  };

  const handleInitiateReactivate = () => {
    setShowReactivateConfirm(true);
  };

  const handleCancelConfirm = () => {
    setShowConfirmForm(false);
    setShowReactivateConfirm(false);
    setSelectedReason("");
    setPassword("");
    setPasswordError("");
  };

  const handleConfirmNlac = () => {
    if (!selectedReason) {
      toast({
        title: "Please select a reason",
        description: "You must select a reason for marking this client as inactive.",
        variant: "destructive",
      });
      return;
    }
    if (!password) {
      setPasswordError("Password is required");
      return;
    }
    setPasswordError("");
    nlacMutation.mutate({ reason: selectedReason, password });
  };

  const handleConfirmReactivate = () => {
    reactivateMutation.mutate();
  };

  const formatReasonLabel = (reason: string) => {
    const found = NLAC_REASONS.find(r => r.value === reason);
    return found ? found.label : reason;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-h-[85vh] overflow-hidden flex flex-col transition-all duration-300 ${(showConfirmForm || showReactivateConfirm) ? 'max-w-4xl' : 'max-w-2xl'}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isClientInactive ? (
              <UserCheck className="h-5 w-5 text-green-600" />
            ) : (
              <UserX className="h-5 w-5" />
            )}
            Client Status - {client.name}
          </DialogTitle>
          <DialogDescription>
            {isClientInactive ? 'Re-activate this client or view status history' : 'Manage client status and view NLAC history'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === 'history') { setShowConfirmForm(false); setShowReactivateConfirm(false); } }} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="action" data-testid="tab-nlac-action">
              {isClientInactive ? (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Re-activate Client
                </>
              ) : (
                <>
                  <UserX className="h-4 w-4 mr-2" />
                  Mark as NLAC
                </>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-nlac-history">
              <History className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="action" className="flex-1 overflow-auto mt-4">
            {isClientInactive ? (
              <div className={`grid gap-6 transition-all duration-300 ${showReactivateConfirm ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {/* Left Column - Reactivation Info */}
                <div className="space-y-6">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-blue-800 dark:text-blue-200">
                          About reactivating a client
                        </h4>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                          Reactivating this client will change their status back to active. 
                          Note that any previously deactivated services and projects will remain inactive - 
                          you will need to set up new services if required.
                        </p>
                      </div>
                    </div>
                  </div>

                  {!showReactivateConfirm && (
                    <div className="flex justify-center">
                      <Button
                        variant="default"
                        onClick={handleInitiateReactivate}
                        data-testid="button-initiate-reactivate"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <UserCheck className="h-4 w-4 mr-2" />
                        Re-activate Client
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Right Column - Reactivation Confirmation */}
                {showReactivateConfirm && (
                  <div className="space-y-4 border-l pl-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        Confirm Reactivation
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelConfirm}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <Separator />

                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Are you sure you want to reactivate <span className="font-medium text-foreground">{client.name}</span>?
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        This will set the client's status back to active. You may need to create new services for this client.
                      </p>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={handleCancelConfirm}
                        className="flex-1"
                        data-testid="button-cancel-reactivate"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleConfirmReactivate}
                        disabled={reactivateMutation.isPending}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        data-testid="button-confirm-reactivate"
                      >
                        {reactivateMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Reactivating...
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-4 w-4 mr-2" />
                            Confirm Reactivation
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={`grid gap-6 transition-all duration-300 ${showConfirmForm ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {/* Left Column - Warning and Action */}
                <div className="space-y-6">
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-amber-800 dark:text-amber-200">
                          About marking a client as inactive
                        </h4>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                          Marking a client as "No Longer a Client" (NLAC) will deactivate all their services and projects. 
                          This action cannot be undone. If the client returns, you will need to set up new services.
                        </p>
                      </div>
                    </div>
                  </div>

                  {!showConfirmForm && (
                    <div className="flex justify-center">
                      <Button
                        variant="destructive"
                        onClick={handleInitiateNlac}
                        data-testid="button-initiate-nlac"
                      >
                        <UserX className="h-4 w-4 mr-2" />
                        Mark Client as Inactive
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  )}

                  {showConfirmForm && (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-medium text-destructive">
                            Warning: This action cannot be undone
                          </h4>
                          <p className="text-sm text-destructive/80 mt-1">
                            Marking a client as inactive will make any services & projects inactive. 
                            If the client returns, or is made inactive in error, you will need to 
                            apply new services to the client.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column - Confirmation Form (appears when showConfirmForm is true) */}
                {showConfirmForm && (
                  <div className="space-y-4 border-l pl-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <UserX className="h-5 w-5 text-destructive" />
                        Confirm NLAC
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelConfirm}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="nlac-reason">Reason for NLAC</Label>
                        <Select
                          value={selectedReason}
                          onValueChange={(value) => setSelectedReason(value as NlacReason)}
                        >
                          <SelectTrigger data-testid="select-nlac-reason">
                            <SelectValue placeholder="Select a reason" />
                          </SelectTrigger>
                          <SelectContent>
                            {NLAC_REASONS.filter(r => r.value !== 'reactivated').map((reason) => (
                              <SelectItem key={reason.value} value={reason.value}>
                                {reason.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="nlac-password">NLAC Password</Label>
                        <div className="relative">
                          <Input
                            id="nlac-password"
                            data-testid="input-nlac-confirm-password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => {
                              setPassword(e.target.value);
                              setPasswordError("");
                            }}
                            placeholder="Enter NLAC password"
                            className={passwordError ? "border-destructive pr-10" : "pr-10"}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <Eye className="w-4 h-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                        {passwordError && (
                          <p className="text-sm text-destructive">{passwordError}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={handleCancelConfirm}
                        className="flex-1"
                        data-testid="button-cancel-nlac-confirm"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleConfirmNlac}
                        disabled={nlacMutation.isPending || !selectedReason || !password}
                        className="flex-1"
                        data-testid="button-submit-nlac"
                      >
                        {nlacMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <UserX className="h-4 w-4 mr-2" />
                            Confirm NLAC
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="flex-1 overflow-auto mt-4">
            {logsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No status history</h3>
                <p className="text-muted-foreground">
                  This client has no status change history
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Performed By</TableHead>
                    <TableHead className="text-right">Impact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id} data-testid={`nlac-log-row-${log.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {log.createdAt && format(new Date(log.createdAt), 'MMM d, yyyy h:mm a')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.reason === 'reactivated' ? 'default' : 'secondary'} className={log.reason === 'reactivated' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : ''}>
                          {formatReasonLabel(log.reason)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{log.performedByUserName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {log.reason === 'reactivated' ? (
                          <span className="text-green-600 dark:text-green-400">Client reactivated</span>
                        ) : (
                          <>
                            {log.projectsDeactivated} projects, {log.servicesDeactivated} services
                            {(log as any).portalUsersDeactivated > 0 && `, ${(log as any).portalUsersDeactivated} portal users`}
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
