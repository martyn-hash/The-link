import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatPersonName } from "../../../utils/formatters";
import type { SMSDialogProps } from "../types";

export function SMSDialog({ 
  clientId, 
  clientPeople,
  isOpen, 
  onClose,
  onSuccess 
}: SMSDialogProps) {
  const { toast } = useToast();
  const [smsPersonId, setSmsPersonId] = useState<string | undefined>();

  const sendSmsMutation = useMutation({
    mutationFn: (data: { to: string; message: string; clientId: string; personId?: string }) => 
      apiRequest('POST', '/api/sms/send', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communications/client', clientId] });
      handleClose();
      toast({
        title: "SMS sent successfully",
        description: "The SMS message has been sent and logged.",
      });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error sending SMS",
        description: error?.message || "Failed to send SMS. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setSmsPersonId(undefined);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const message = formData.get('message') as string;

    if (!smsPersonId) {
      toast({ title: 'Contact person required', description: 'Please select a person to send the SMS to.', variant: 'destructive' });
      return;
    }
    const selected = (clientPeople || []).find((cp: any) => cp.person.id === smsPersonId);
    const to = selected?.person?.primaryPhone;

    if (!to) {
      toast({ title: 'No mobile number', description: 'The selected person has no Primary Mobile saved.', variant: 'destructive' });
      return;
    }
    if (!message?.trim()) {
      toast({ title: 'Message required', description: 'Please enter a message.', variant: 'destructive' });
      return;
    }

    sendSmsMutation.mutate({
      to,
      message,
      clientId,
      personId: smsPersonId,
    });
  };

  const selectedPerson = clientPeople?.find((cp: any) => cp.person.id === smsPersonId);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send SMS
          </DialogTitle>
          <DialogDescription>
            Send an SMS using the selected person's Primary Mobile. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Contact Person <span className="text-destructive">*</span></label>
            <Select value={smsPersonId} onValueChange={(value) => setSmsPersonId(value)}>
              <SelectTrigger data-testid="select-sms-person">
                <SelectValue placeholder="Select person" />
              </SelectTrigger>
              <SelectContent>
                {(clientPeople || []).map((cp: any) => (
                  <SelectItem key={cp.person.id} value={cp.person.id}>
                    {formatPersonName(cp.person.fullName)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {smsPersonId && (
              <p className="text-xs text-muted-foreground">
                Mobile: {selectedPerson?.person?.primaryPhone || '—'}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Message <span className="text-destructive">*</span></label>
            <Textarea
              name="message"
              placeholder="Enter your SMS message..."
              className="min-h-[100px]"
              required
              data-testid="textarea-sms-message"
            />
            <p className="text-xs text-muted-foreground">Maximum 160 characters for a single SMS</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={sendSmsMutation.isPending} data-testid="button-send-sms-dialog">
              {sendSmsMutation.isPending ? 'Sending...' : 'Send SMS'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
