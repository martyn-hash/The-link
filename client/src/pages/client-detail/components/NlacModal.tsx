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
  DialogFooter,
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
import { AlertTriangle, History, UserX, Loader2, Eye, EyeOff, Clock, User } from "lucide-react";
import { format } from "date-fns";
import type { Client, NlacAuditLog } from "@shared/schema";

const NLAC_REASONS = [
  { value: "moving_to_new_accountant", label: "Moving to new accountant" },
  { value: "ceasing_trading", label: "Ceasing trading" },
  { value: "no_longer_using_accountant", label: "No longer using an accountant" },
  { value: "taking_accounts_in_house", label: "Taking accounts in house" },
  { value: "other", label: "Other" },
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
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedReason, setSelectedReason] = useState<NlacReason | "">("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

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

  const resetAndClose = () => {
    setShowWarningDialog(false);
    setShowConfirmDialog(false);
    setSelectedReason("");
    setPassword("");
    setPasswordError("");
    setShowPassword(false);
    onOpenChange(false);
  };

  const handleInitiateNlac = () => {
    setShowWarningDialog(true);
  };

  const handleWarningConfirm = () => {
    setShowWarningDialog(false);
    setShowConfirmDialog(true);
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

  const formatReasonLabel = (reason: string) => {
    const found = NLAC_REASONS.find(r => r.value === reason);
    return found ? found.label : reason;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5" />
              Client Status - {client.name}
            </DialogTitle>
            <DialogDescription>
              Manage client status and view NLAC history
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="action" data-testid="tab-nlac-action">
                <UserX className="h-4 w-4 mr-2" />
                Mark as NLAC
              </TabsTrigger>
              <TabsTrigger value="history" data-testid="tab-nlac-history">
                <History className="h-4 w-4 mr-2" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="action" className="flex-1 overflow-auto mt-4">
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

                <div className="flex justify-center">
                  <Button
                    variant="destructive"
                    onClick={handleInitiateNlac}
                    data-testid="button-initiate-nlac"
                    disabled={client.companyStatus === 'inactive'}
                  >
                    <UserX className="h-4 w-4 mr-2" />
                    {client.companyStatus === 'inactive' ? 'Client is already inactive' : 'Mark Client as Inactive'}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="flex-1 overflow-auto mt-4">
              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No NLAC history</h3>
                  <p className="text-muted-foreground">
                    This client has never been marked as inactive
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Reason</TableHead>
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
                          <Badge variant="secondary">
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
                          {log.projectsDeactivated} projects, {log.servicesDeactivated} services
                          {(log as any).portalUsersDeactivated > 0 && `, ${(log as any).portalUsersDeactivated} portal users`}
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

      {/* Warning Dialog */}
      <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Warning: This action cannot be undone
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Marking a client as inactive will make any services & projects inactive. 
                This process cannot be undone.
              </p>
              <p>
                If the client returns, or is made inactive in error, you will need to 
                apply new services to the client.
              </p>
              <p className="font-medium">Are you sure you wish to proceed?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-nlac-warning">No, cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleWarningConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-nlac-warning"
            >
              Yes, proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog with reason and password */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-destructive" />
              Confirm NLAC for {client.name}
            </DialogTitle>
            <DialogDescription>
              Please provide the reason and password to complete this action.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
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
                  {NLAC_REASONS.map((reason) => (
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

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              data-testid="button-cancel-nlac-confirm"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmNlac}
              disabled={nlacMutation.isPending || !selectedReason || !password}
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
