import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Share2, History, CheckCircle, XCircle, Clock, AlertCircle, Send, Loader2 } from "lucide-react";
import type { Client, ClientPerson, WebhookConfig, WebhookLogWithDetails } from "@shared/schema";

interface AvailableWebhook extends WebhookConfig {
  isAvailable: boolean;
  missingFields?: string[];
  hasPriorSuccess?: boolean;
  willUseUpdateUrl?: boolean;
}

interface ShareDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client;
  people: ClientPerson[];
}

export function ShareDataModal({ open, onOpenChange, client, people }: ShareDataModalProps) {
  const { toast } = useToast();
  const [selectedWebhooks, setSelectedWebhooks] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("send");

  const { data: availableWebhooks = [], isLoading: webhooksLoading } = useQuery<AvailableWebhook[]>({
    queryKey: [`/api/clients/${client.id}/webhooks`],
    enabled: open,
  });

  const { data: webhookLogs = [], isLoading: logsLoading, refetch: refetchLogs } = useQuery<WebhookLogWithDetails[]>({
    queryKey: [`/api/clients/${client.id}/webhook-logs`],
    enabled: open && activeTab === "history",
  });

  const sendMutation = useMutation({
    mutationFn: async (webhookConfigIds: string[]) => {
      return await apiRequest("POST", `/api/clients/${client.id}/webhooks/send`, { webhookConfigIds });
    },
    onSuccess: (response: any) => {
      const successCount = response.results?.filter((r: any) => r.success).length || 0;
      const failCount = response.results?.filter((r: any) => !r.success).length || 0;
      
      if (successCount > 0 && failCount === 0) {
        toast({ 
          title: "Data sent successfully", 
          description: `Client data has been shared with ${successCount} webhook${successCount > 1 ? 's' : ''}`
        });
      } else if (successCount > 0 && failCount > 0) {
        toast({ 
          title: "Partially sent", 
          description: `Sent to ${successCount} webhook${successCount > 1 ? 's' : ''}, ${failCount} failed`,
          variant: "default"
        });
      } else {
        showFriendlyError({ error: "All webhook sends failed. Check the history for details." });
      }
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${client.id}/webhook-logs`] });
      setSelectedWebhooks([]);
      refetchLogs();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${client.id}/webhook-logs`] });
      refetchLogs();
    },
  });

  const handleSendSelected = () => {
    if (selectedWebhooks.length > 0) {
      sendMutation.mutate(selectedWebhooks);
    }
  };

  const toggleWebhook = (webhookId: string) => {
    setSelectedWebhooks(prev => 
      prev.includes(webhookId) 
        ? prev.filter(id => id !== webhookId)
        : [...prev, webhookId]
    );
  };

  const availableToSend = availableWebhooks.filter(w => w.isAvailable);
  const unavailableWebhooks = availableWebhooks.filter(w => !w.isAvailable);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Data - {client.name}
          </DialogTitle>
          <DialogDescription>
            Send client data to external systems via configured webhooks
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="send" data-testid="tab-send">
              <Send className="h-4 w-4 mr-2" />
              Send Data
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <History className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="flex-1 overflow-auto mt-4">
            {webhooksLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableWebhooks.length === 0 ? (
              <div className="text-center py-8">
                <Share2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No webhooks configured</h3>
                <p className="text-muted-foreground">
                  Ask a Super Admin to configure webhooks in the admin settings
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {availableToSend.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-foreground">Available Webhooks</h4>
                    {availableToSend.map((webhook) => (
                      <Card 
                        key={webhook.id} 
                        className={`cursor-pointer transition-colors ${
                          selectedWebhooks.includes(webhook.id) ? 'border-primary' : ''
                        }`}
                        onClick={() => toggleWebhook(webhook.id)}
                        data-testid={`webhook-option-${webhook.id}`}
                      >
                        <CardHeader className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={selectedWebhooks.includes(webhook.id)}
                              onCheckedChange={() => toggleWebhook(webhook.id)}
                              data-testid={`checkbox-webhook-${webhook.id}`}
                            />
                            <div className="flex-1">
                              <CardTitle className="text-base">{webhook.name}</CardTitle>
                              {webhook.description && (
                                <CardDescription className="text-sm mt-1">
                                  {webhook.description}
                                </CardDescription>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {webhook.willUseUpdateUrl && (
                                <Badge variant="outline" className="text-blue-600 border-blue-200 dark:text-blue-400 dark:border-blue-800">
                                  Update mode
                                </Badge>
                              )}
                              <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                Ready
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                )}

                {unavailableWebhooks.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground">
                      Unavailable (missing required fields)
                    </h4>
                    {unavailableWebhooks.map((webhook) => (
                      <Card key={webhook.id} className="opacity-60" data-testid={`webhook-unavailable-${webhook.id}`}>
                        <CardHeader className="py-3 px-4">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="h-4 w-4 mt-1 text-amber-500" />
                            <div className="flex-1">
                              <CardTitle className="text-base">{webhook.name}</CardTitle>
                              {webhook.missingFields && webhook.missingFields.length > 0 && (
                                <CardDescription className="text-sm mt-1 text-amber-600 dark:text-amber-400">
                                  Missing: {webhook.missingFields.join(", ")}
                                </CardDescription>
                              )}
                            </div>
                            <Badge variant="secondary">Not Available</Badge>
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                )}

                {selectedWebhooks.length > 0 && (
                  <div className="sticky bottom-0 pt-4 border-t bg-background">
                    <Button 
                      className="w-full" 
                      onClick={handleSendSelected}
                      disabled={sendMutation.isPending}
                      data-testid="btn-send-data"
                    >
                      {sendMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send to {selectedWebhooks.length} webhook{selectedWebhooks.length > 1 ? 's' : ''}
                        </>
                      )}
                    </Button>
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
            ) : webhookLogs.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No history yet</h3>
                <p className="text-muted-foreground">
                  Data sharing history for this client will appear here
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead>Webhook</TableHead>
                    <TableHead>Sent By</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhookLogs.map((log) => (
                    <TableRow key={log.id} data-testid={`log-row-${log.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {log.status === 'success' && (
                            <>
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span className="text-sm text-green-600">Success</span>
                            </>
                          )}
                          {log.status === 'failed' && (
                            <>
                              <XCircle className="h-4 w-4 text-red-500" />
                              <span className="text-sm text-red-600">Failed</span>
                            </>
                          )}
                          {log.status === 'pending' && (
                            <>
                              <Clock className="h-4 w-4 text-yellow-500" />
                              <span className="text-sm text-yellow-600">Pending</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{log.webhookName}</span>
                        {log.status === 'failed' && log.errorMessage && (
                          <p className="text-xs text-red-500 mt-1">{log.errorMessage}</p>
                        )}
                      </TableCell>
                      <TableCell>{log.triggeredByName}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {log.sentAt && new Date(log.sentAt).toLocaleString()}
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
