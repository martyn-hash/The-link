import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Send, Mail, Clock, Users, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import type { BookkeepingQueryWithRelations } from "@shared/schema";

interface SendToClientDialogProps {
  projectId: string;
  clientId: string;
  queries: BookkeepingQueryWithRelations[];
  selectedQueryIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function formatCurrency(amount: string | null | undefined): string {
  if (!amount) return "";
  const num = parseFloat(amount);
  if (isNaN(num)) return "";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(num);
}

export function SendToClientDialog({
  projectId,
  clientId,
  queries,
  selectedQueryIds,
  isOpen,
  onClose,
  onSuccess,
}: SendToClientDialogProps) {
  const { toast } = useToast();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [expiryDays, setExpiryDays] = useState<string>("7");
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>("");
  const [useCustomEmail, setUseCustomEmail] = useState(false);

  // Fetch client people for recipient selection
  const { data: clientPeople } = useQuery<any[]>({
    queryKey: ['/api/clients', clientId, 'people'],
    enabled: !!clientId && isOpen,
  });

  // Filter to only selected queries
  const selectedQueries = useMemo(() => {
    return queries.filter(q => selectedQueryIds.includes(q.id));
  }, [queries, selectedQueryIds]);

  // Build list of all email options for all people (each email is a separate option)
  const emailOptions = useMemo(() => {
    if (!clientPeople) return [];
    const options: Array<{
      id: string;
      personId: string;
      fullName: string;
      email: string;
      role: string | null;
      isPrimary: boolean;
    }> = [];
    
    clientPeople.forEach((cp: any) => {
      const person = cp.person;
      if (!person) return;
      
      const fullName = person.fullName || `${person.firstName || ''} ${person.lastName || ''}`.trim();
      const role = cp.role || null;
      
      // Collect all unique emails for this person
      const emails: Array<{ email: string; isPrimary: boolean }> = [];
      
      if (person.primaryEmail?.trim()) {
        emails.push({ email: person.primaryEmail.trim(), isPrimary: true });
      }
      if (person.email?.trim() && !emails.some(e => e.email.toLowerCase() === person.email.trim().toLowerCase())) {
        emails.push({ email: person.email.trim(), isPrimary: !person.primaryEmail });
      }
      if (person.email2?.trim() && !emails.some(e => e.email.toLowerCase() === person.email2.trim().toLowerCase())) {
        emails.push({ email: person.email2.trim(), isPrimary: false });
      }
      
      // Create an option for each email
      emails.forEach((emailObj, idx) => {
        options.push({
          id: `${person.id}-${idx}`,
          personId: person.id,
          fullName,
          email: emailObj.email,
          role,
          isPrimary: emailObj.isPrimary,
        });
      });
    });
    
    return options;
  }, [clientPeople]);

  // Handle selecting an email option
  const handleRecipientChange = (optionId: string) => {
    setSelectedRecipientId(optionId);
    const option = emailOptions.find(o => o.id === optionId);
    if (option) {
      setRecipientEmail(option.email);
      setRecipientName(option.fullName);
      setUseCustomEmail(false);
    }
  };

  // Send to client mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/projects/${projectId}/queries/send-to-client`, {
        queryIds: selectedQueryIds,
        recipientEmail: recipientEmail,
        recipientName: recipientName || undefined,
        expiryDays: parseInt(expiryDays, 10),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'queries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/queries/counts'] });
      
      if (data.emailWarning) {
        // Email failed but token was created
        toast({
          title: "Queries marked as sent",
          description: `${data.emailWarning} Response URL: ${window.location.origin}${data.responseUrl}`,
          duration: 10000,
        });
      } else {
        toast({
          title: "Queries sent to client",
          description: `${selectedQueryIds.length} queries have been sent to ${recipientEmail}. Link expires in ${expiryDays} days.`,
        });
      }
      
      onSuccess?.();
      onClose();
      resetForm();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send queries to client.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setRecipientEmail("");
    setRecipientName("");
    setExpiryDays("7");
    setSelectedRecipientId("");
    setUseCustomEmail(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSend = () => {
    if (!recipientEmail.trim()) {
      toast({
        title: "Recipient required",
        description: "Please enter a recipient email address.",
        variant: "destructive",
      });
      return;
    }
    sendMutation.mutate();
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const canSend = recipientEmail.trim() && isValidEmail(recipientEmail) && selectedQueryIds.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Send Queries to Client
          </DialogTitle>
          <DialogDescription>
            Generate a secure link for the client to respond to {selectedQueryIds.length} {selectedQueryIds.length === 1 ? 'query' : 'queries'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          {/* Recipient Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Recipient</Label>
            
            {emailOptions.length > 0 && !useCustomEmail ? (
              <Select value={selectedRecipientId} onValueChange={handleRecipientChange}>
                <SelectTrigger data-testid="select-recipient">
                  <SelectValue placeholder="Select a contact email..." />
                </SelectTrigger>
                <SelectContent>
                  {emailOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{option.fullName}</span>
                        <span className="text-muted-foreground">—</span>
                        <span className="text-muted-foreground">{option.email}</span>
                        {option.isPrimary && (
                          <Badge variant="secondary" className="text-xs py-0">
                            Primary
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2">
                {emailOptions.length === 0 && !useCustomEmail && (
                  <p className="text-sm text-muted-foreground mb-2">
                    No contacts with email addresses found for this client. Enter an email address below.
                  </p>
                )}
                <Input
                  type="email"
                  placeholder="recipient@example.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  data-testid="input-recipient-email"
                />
                <Input
                  type="text"
                  placeholder="Recipient name (optional)"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  data-testid="input-recipient-name"
                />
              </div>
            )}

            {emailOptions.length > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="use-custom-email"
                  checked={useCustomEmail}
                  onCheckedChange={(checked) => {
                    setUseCustomEmail(!!checked);
                    if (checked) {
                      setSelectedRecipientId("");
                      setRecipientEmail("");
                      setRecipientName("");
                    }
                  }}
                  data-testid="checkbox-custom-email"
                />
                <Label htmlFor="use-custom-email" className="text-sm cursor-pointer">
                  Enter a different email address
                </Label>
              </div>
            )}
          </div>

          <Separator />

          {/* Link Expiry */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Link Expires After
            </Label>
            <Select value={expiryDays} onValueChange={setExpiryDays}>
              <SelectTrigger className="w-48" data-testid="select-expiry">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Query Preview */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Queries to Send ({selectedQueries.length})
            </Label>
            <ScrollArea className="h-48 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-24">Amount</TableHead>
                    <TableHead>Query</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedQueries.map((query) => (
                    <TableRow key={query.id}>
                      <TableCell className="text-sm">
                        {query.date ? format(new Date(query.date), 'dd MMM') : '-'}
                      </TableCell>
                      <TableCell className="text-sm max-w-32 truncate">
                        {query.description || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {query.moneyIn ? formatCurrency(query.moneyIn) : 
                         query.moneyOut ? `-${formatCurrency(query.moneyOut)}` : '-'}
                      </TableCell>
                      <TableCell className="text-sm max-w-48 truncate">
                        {query.ourQuery}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          {/* Info Box */}
          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
            <p className="font-medium flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              What happens next
            </p>
            <ul className="text-muted-foreground space-y-1 ml-6 list-disc">
              <li>The client will receive a secure link to view and respond to these queries</li>
              <li>They can update the VAT status and add responses for each transaction</li>
              <li>Once submitted, queries will be marked as "Client Answered"</li>
              <li>The link will expire after {expiryDays} days</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!canSend || sendMutation.isPending}
            data-testid="button-send-queries"
          >
            {sendMutation.isPending ? (
              "Sending..."
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send {selectedQueryIds.length} {selectedQueryIds.length === 1 ? 'Query' : 'Queries'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
