import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { TiptapEditor } from "@/components/TiptapEditor";
import { formatPersonName } from "../../utils/formatters";
import type { EmailDialogProps } from "../types";

export function EmailDialog({ 
  clientId, 
  clientPeople,
  user,
  isOpen, 
  onClose,
  onSuccess 
}: EmailDialogProps) {
  const { toast } = useToast();
  const [emailPersonId, setEmailPersonId] = useState<string | undefined>();
  const [emailContent, setEmailContent] = useState<string>('');

  const sendEmailMutation = useMutation({
    mutationFn: (data: { to: string; subject: string; content: string; clientId: string; personId?: string; isHtml?: boolean }) => 
      apiRequest('POST', '/api/email/send', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communications/client', clientId] });
      handleClose();
      toast({
        title: "Email sent successfully",
        description: "The email has been sent and logged.",
      });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error sending email",
        description: error?.message || "Failed to send email. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setEmailPersonId(undefined);
    setEmailContent('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const subject = formData.get('subject') as string;
    
    if (!emailPersonId) {
      toast({ title: 'Contact person required', description: 'Please select a person to send the email to.', variant: 'destructive' });
      return;
    }
    const selected = (clientPeople || []).find((cp: any) => cp.person.id === emailPersonId);
    const to = selected?.person?.primaryEmail;

    if (!to) {
      toast({ title: 'No email address', description: 'The selected person has no Primary Email saved.', variant: 'destructive' });
      return;
    }
    
    const textContent = emailContent
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&[a-zA-Z]+;/g, '')
      .trim();
    if (!textContent || textContent.length === 0) {
      toast({ title: 'Message required', description: 'Please enter a message.', variant: 'destructive' });
      return;
    }
    
    let finalEmailContent = emailContent;
    if (user?.emailSignature && user.emailSignature.trim()) {
      const spacing = emailContent.trim() ? '<br><br>' : '';
      finalEmailContent = emailContent + spacing + user.emailSignature;
    }
    
    sendEmailMutation.mutate({
      to,
      subject: subject || 'Message from CRM',
      content: finalEmailContent,
      isHtml: true,
      clientId: clientId,
      personId: emailPersonId,
    });
  };

  const selectedPerson = clientPeople?.find((cp: any) => cp.person.id === emailPersonId);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleClose();
      if (open) {
        setEmailContent('');
        setEmailPersonId(undefined);
      }
    }}>
      <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Email
          </DialogTitle>
          <DialogDescription>
            Send an email using the selected person's Primary Email. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Contact Person <span className="text-destructive">*</span></label>
            <Select value={emailPersonId} onValueChange={(value) => setEmailPersonId(value)}>
              <SelectTrigger data-testid="select-email-person">
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
            {emailPersonId && (
              <p className="text-xs text-muted-foreground">
                Email: {selectedPerson?.person?.primaryEmail || '—'}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Subject</label>
            <Input
              name="subject"
              placeholder="Message from CRM"
              data-testid="input-email-subject-dialog"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Message <span className="text-destructive">*</span></label>
            <div data-testid="input-email-content-editor">
              <TiptapEditor
                content={emailContent}
                onChange={setEmailContent}
                placeholder="Enter your email message..."
                editorHeight="300px"
              />
            </div>
            <p className="text-xs text-muted-foreground">Uses the person's Primary Email address</p>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={sendEmailMutation.isPending} data-testid="button-send-email-dialog">
              {sendEmailMutation.isPending ? 'Sending...' : 'Send Email'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
