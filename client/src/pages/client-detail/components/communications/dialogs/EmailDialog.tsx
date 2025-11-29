import { useState, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Mail, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AudioRecorder } from "@/components/AudioRecorder";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TiptapEditor } from "@/components/TiptapEditor";
import { FileUploadZone, AttachmentList } from "@/components/attachments";
import { formatPersonName } from "../../../utils/formatters";
import type { EmailDialogProps } from "../types";

interface EmailAttachment {
  filename: string;
  contentType: string;
  content: string; // Base64 encoded
  size: number;
}

// Helper function to convert file to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Remove the data:mime/type;base64, prefix
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
}

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
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isAttachmentsOpen, setIsAttachmentsOpen] = useState(false);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  
  // Filter to only show people with email addresses (check primaryEmail first, fallback to email)
  const peopleWithEmail = (clientPeople || []).filter((cp: any) => {
    const email = cp.person?.primaryEmail || cp.person?.email;
    return email && email.trim() !== '';
  });

  // Handle files being selected
  const handleFilesSelected = useCallback(async (files: File[]) => {
    const newAttachments: EmailAttachment[] = [];
    const newPendingFiles: File[] = [];
    
    for (const file of files) {
      try {
        const base64 = await fileToBase64(file);
        newAttachments.push({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          content: base64,
          size: file.size,
        });
        newPendingFiles.push(file);
      } catch (error) {
        console.error('Error converting file to base64:', error);
        showFriendlyError({ error: `Could not process ${file.name}` });
      }
    }
    
    setAttachments(prev => [...prev, ...newAttachments]);
    setPendingFiles(prev => [...prev, ...newPendingFiles]);
    setIsAttachmentsOpen(true);
  }, [toast]);

  // Remove an attachment
  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const sendEmailMutation = useMutation({
    mutationFn: (data: { to: string; subject: string; content: string; clientId: string; personId?: string; isHtml?: boolean; attachments?: EmailAttachment[] }) => 
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
      showFriendlyError({ error });
    },
  });

  const handleClose = () => {
    setEmailPersonId(undefined);
    setEmailContent('');
    setAttachments([]);
    setPendingFiles([]);
    setIsAttachmentsOpen(false);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const subject = formData.get('subject') as string;
    
    if (!emailPersonId) {
      showFriendlyError({ error: 'Please select a person to send the email to.' });
      return;
    }
    const selected = (clientPeople || []).find((cp: any) => cp.person.id === emailPersonId);
    const to = selected?.person?.primaryEmail || selected?.person?.email;

    if (!to) {
      showFriendlyError({ error: 'The selected person has no Primary Email saved.' });
      return;
    }
    
    const textContent = emailContent
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&[a-zA-Z]+;/g, '')
      .trim();
    if (!textContent || textContent.length === 0) {
      showFriendlyError({ error: 'Please enter a message.' });
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
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  };

  const selectedPerson = clientPeople?.find((cp: any) => cp.person.id === emailPersonId);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleClose();
      if (open) {
        setEmailContent('');
        setEmailPersonId(undefined);
        setAttachments([]);
        setPendingFiles([]);
        setIsAttachmentsOpen(false);
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
                {peopleWithEmail.map((cp: any) => (
                  <SelectItem key={cp.person.id} value={cp.person.id}>
                    {formatPersonName(cp.person.fullName)} - {cp.person.primaryEmail || cp.person.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {emailPersonId && (
              <p className="text-xs text-muted-foreground">
                Email: {selectedPerson?.person?.primaryEmail || selectedPerson?.person?.email || '—'}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Subject</label>
            <Input
              ref={subjectInputRef}
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

          <div className="flex items-center gap-2 pt-2 border-t">
            <AudioRecorder
              mode="email"
              disabled={sendEmailMutation.isPending}
              onResult={(result) => {
                if (result.subject && subjectInputRef.current) {
                  subjectInputRef.current.value = result.subject;
                }
                if (result.content) {
                  setEmailContent(result.content);
                }
              }}
            />
            <span className="text-xs text-muted-foreground">
              Record what you want to say and AI will draft the email
            </span>
          </div>
          
          {/* Attachments Section */}
          <Collapsible open={isAttachmentsOpen} onOpenChange={setIsAttachmentsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                data-testid="button-toggle-attachments"
              >
                <Paperclip className="h-4 w-4" />
                Attachments
                {attachments.length > 0 && (
                  <span className="bg-primary text-primary-foreground px-1.5 py-0.5 rounded text-xs">
                    {attachments.length}
                  </span>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3">
              <FileUploadZone
                onFilesSelected={handleFilesSelected}
                maxFiles={5}
                maxSize={10 * 1024 * 1024} // 10MB per file
                acceptedTypes={['image/*', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv']}
                compact
              />
              {pendingFiles.length > 0 && (
                <AttachmentList
                  attachments={pendingFiles}
                  onRemove={handleRemoveAttachment}
                />
              )}
            </CollapsibleContent>
          </Collapsible>
          
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
