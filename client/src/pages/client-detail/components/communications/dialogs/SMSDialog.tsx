import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Send, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { formatPersonName } from "../../../utils/formatters";
import { SmsTemplatePicker } from "@/components/SmsTemplatePicker";
import type { SMSDialogProps } from "../types";

export function SMSDialog({ 
  clientId, 
  projectId,
  clientPeople,
  isOpen, 
  onClose,
  onSuccess,
  initialValues
}: SMSDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [smsPersonId, setSmsPersonId] = useState<string | undefined>(initialValues?.personId);
  const [message, setMessage] = useState(initialValues?.message || '');
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [usedTemplateId, setUsedTemplateId] = useState<string | null>(null);
  const [rawTemplateContent, setRawTemplateContent] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Filter to only show people with mobile numbers (check primaryPhone first, fallback to telephone)
  const peopleWithMobile = (clientPeople || []).filter((cp: any) => {
    const phone = cp.person?.primaryPhone || cp.person?.telephone;
    return phone && phone.trim() !== '';
  });

  const sendSmsMutation = useMutation({
    mutationFn: (data: { to: string; message: string; clientId: string; personId?: string; projectId?: string; templateId?: string }) => 
      apiRequest('POST', '/api/sms/send', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communications/client', clientId] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/communications`] });
      }
      handleClose();
      toast({
        title: "SMS sent successfully",
        description: "The SMS message has been sent and logged.",
      });
      onSuccess?.();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const handleClose = () => {
    setSmsPersonId(undefined);
    setMessage('');
    setUsedTemplateId(null);
    setRawTemplateContent(null);
    onClose();
  };

  const getRecipientFirstName = (personId?: string): string | undefined => {
    const idToCheck = personId ?? smsPersonId;
    const selected = (clientPeople || []).find((cp: any) => cp.person.id === idToCheck);
    if (selected?.person) {
      // Use firstName field if available, otherwise extract from fullName
      if (selected.person.firstName) {
        return selected.person.firstName;
      }
      if (selected.person.fullName) {
        const names = selected.person.fullName.split(' ');
        return names[0];
      }
    }
    return undefined;
  };

  const applyVariableSubstitution = (content: string, recipientFirstName?: string): string => {
    let result = content;
    
    // Replace {firstName} with recipient's first name
    if (recipientFirstName) {
      result = result.replace(/\{firstName\}/g, recipientFirstName).replace(/\[First Name\]/g, recipientFirstName);
    } else {
      result = result.replace(/\{firstName\}/g, '[First Name]');
    }
    
    // Replace {userFirstName} with current user's first name
    if (user?.firstName) {
      result = result.replace(/\{userFirstName\}/g, user.firstName).replace(/\[Your Name\]/g, user.firstName);
    } else {
      result = result.replace(/\{userFirstName\}/g, '[Your Name]');
    }
    
    // Replace {calendlyLink} with current user's Calendly link
    if (user?.calendlyLink) {
      result = result.replace(/\{calendlyLink\}/g, user.calendlyLink).replace(/\[Calendly Link\]/g, user.calendlyLink);
    } else {
      result = result.replace(/\{calendlyLink\}/g, '[Calendly Link]');
    }
    
    return result;
  };

  const handleTemplateSelect = (content: string, templateId: string) => {
    setRawTemplateContent(content);
    setUsedTemplateId(templateId);
    const firstName = getRecipientFirstName();
    setMessage(applyVariableSubstitution(content, firstName));
  };

  const handlePersonChange = (newPersonId: string) => {
    setSmsPersonId(newPersonId);
    if (rawTemplateContent) {
      const firstName = getRecipientFirstName(newPersonId);
      setMessage(applyVariableSubstitution(rawTemplateContent, firstName));
    }
  };

  const hasUnreplacedVariables = message.includes('[First Name]') || message.includes('[Your Name]') || message.includes('[Calendly Link]');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!smsPersonId) {
      showFriendlyError({ error: 'Please select a person to send the SMS to.' });
      return;
    }
    const selected = (clientPeople || []).find((cp: any) => cp.person.id === smsPersonId);
    const to = selected?.person?.primaryPhone || selected?.person?.telephone;

    if (!to) {
      showFriendlyError({ error: 'The selected person has no Primary Mobile saved.' });
      return;
    }
    if (!message?.trim()) {
      showFriendlyError({ error: 'Please enter a message.' });
      return;
    }

    sendSmsMutation.mutate({
      to,
      message,
      clientId,
      personId: smsPersonId,
      projectId,
      ...(usedTemplateId && { templateId: usedTemplateId }),
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
            <Select value={smsPersonId} onValueChange={handlePersonChange}>
              <SelectTrigger data-testid="select-sms-person">
                <SelectValue placeholder="Select person" />
              </SelectTrigger>
              <SelectContent>
                {peopleWithMobile.map((cp: any) => (
                  <SelectItem key={cp.person.id} value={cp.person.id}>
                    {formatPersonName(cp.person.fullName)} - {cp.person.primaryPhone || cp.person.telephone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {smsPersonId && (
              <p className="text-xs text-muted-foreground">
                Mobile: {selectedPerson?.person?.primaryPhone || selectedPerson?.person?.telephone || '—'}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Message <span className="text-destructive">*</span></label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsTemplatePickerOpen(true)}
                data-testid="button-add-from-template"
              >
                <FileText className="h-4 w-4 mr-1" />
                Add from template
              </Button>
            </div>
            <Textarea
              ref={textareaRef}
              name="message"
              placeholder="Enter your SMS message..."
              className="min-h-[160px]"
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              data-testid="textarea-sms-message"
            />
            <p className="text-xs text-muted-foreground">
              {message.length} / 160 characters {message.length > 160 ? `(${Math.ceil(message.length / 160)} SMS)` : '(1 SMS)'}
            </p>
          </div>

          {hasUnreplacedVariables && (
            <Alert variant="default" data-testid="alert-unreplaced-variables">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {message.includes('[First Name]') && 'Message contains "[First Name]" placeholder - select a recipient to fill in their name. '}
                {message.includes('[Your Name]') && 'Your name is not set in your profile. '}
                {message.includes('[Calendly Link]') && 'Your Calendly link is not set in your profile. '}
                Edit the message manually or update your profile settings.
              </AlertDescription>
            </Alert>
          )}

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

      <SmsTemplatePicker
        isOpen={isTemplatePickerOpen}
        onClose={() => setIsTemplatePickerOpen(false)}
        onSelect={handleTemplateSelect}
        recipientFirstName={getRecipientFirstName()}
      />
    </Dialog>
  );
}
