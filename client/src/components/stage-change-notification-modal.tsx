import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Mail, Bell, Users } from "lucide-react";
import { TiptapEditor } from "@/components/TiptapEditor";
import type { StageChangeNotificationPreview } from "@shared/schema";

interface StageChangeNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  preview: StageChangeNotificationPreview | null;
  onSend: (editedData: {
    emailSubject: string;
    emailBody: string;
    pushTitle: string | null;
    pushBody: string | null;
    suppress: boolean;
  }) => Promise<void>;
}

export function StageChangeNotificationModal({
  isOpen,
  onClose,
  preview,
  onSend,
}: StageChangeNotificationModalProps) {
  const [emailSubject, setEmailSubject] = useState(preview?.emailSubject || "");
  const [emailBody, setEmailBody] = useState(preview?.emailBody || "");
  const [pushTitle, setPushTitle] = useState(preview?.pushTitle || "");
  const [pushBody, setPushBody] = useState(preview?.pushBody || "");
  const [isSending, setIsSending] = useState(false);

  // Reset form when preview changes
  useEffect(() => {
    if (preview) {
      setEmailSubject(preview.emailSubject);
      setEmailBody(preview.emailBody);
      setPushTitle(preview.pushTitle || "");
      setPushBody(preview.pushBody || "");
    }
  }, [preview]);

  const handleSend = async (suppress: boolean) => {
    setIsSending(true);
    try {
      await onSend({
        emailSubject,
        emailBody,
        pushTitle: pushTitle || null,
        pushBody: pushBody || null,
        suppress,
      });
      onClose();
    } catch (error) {
      console.error("Error sending notification:", error);
    } finally {
      setIsSending(false);
    }
  };

  if (!preview) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-stage-change-notification">
        <DialogHeader>
          <DialogTitle data-testid="text-notification-title">Send Stage Change Notification?</DialogTitle>
          <DialogDescription data-testid="text-notification-description">
            The stage has been updated successfully. Would you like to notify the assignees?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Recipients */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Recipients ({preview.recipients.length})</Label>
            </div>
            <div className="bg-muted/30 p-3 rounded-md space-y-1">
              {preview.recipients.map((recipient) => (
                <div key={recipient.userId} className="text-sm" data-testid={`text-recipient-${recipient.userId}`}>
                  <span className="font-medium">{recipient.name}</span>
                  <span className="text-muted-foreground ml-2">({recipient.email})</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Email Notification */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Email Notification</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                data-testid="input-email-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Email subject"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-body">Body</Label>
              <div data-testid="editor-email-body" className="border rounded-md">
                <TiptapEditor
                  content={emailBody}
                  onChange={setEmailBody}
                  placeholder="Email body content..."
                  editorHeight="200px"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Push Notification */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Push Notification (Optional)</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="push-title">Title</Label>
              <Input
                id="push-title"
                data-testid="input-push-title"
                value={pushTitle}
                onChange={(e) => setPushTitle(e.target.value)}
                placeholder="Push notification title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="push-body">Body</Label>
              <Input
                id="push-body"
                data-testid="input-push-body"
                value={pushBody}
                onChange={(e) => setPushBody(e.target.value)}
                placeholder="Push notification body"
              />
            </div>
          </div>

          {/* Metadata Info */}
          <div className="bg-muted/20 p-4 rounded-md">
            <h4 className="text-sm font-medium mb-2">Notification Details</h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div data-testid="text-project-name">
                <span className="font-medium">Project:</span> {preview.metadata.projectName}
              </div>
              <div data-testid="text-client-name">
                <span className="font-medium">Client:</span> {preview.metadata.clientName}
              </div>
              <div data-testid="text-stage-change">
                <span className="font-medium">Stage Change:</span>{" "}
                {preview.oldStageName ? `${preview.oldStageName} → ` : ""}
                {preview.newStageName}
              </div>
              {preview.metadata.dueDate && (
                <div data-testid="text-due-date">
                  <span className="font-medium">Due Date:</span> {preview.metadata.dueDate}
                </div>
              )}
              {preview.metadata.changeReason && (
                <div data-testid="text-change-reason">
                  <span className="font-medium">Reason:</span> {preview.metadata.changeReason}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isSending}
            data-testid="button-skip"
          >
            Skip
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSend(true)}
            disabled={isSending}
            data-testid="button-dont-send"
          >
            Don't Send (Log as Suppressed)
          </Button>
          <Button
            onClick={() => handleSend(false)}
            disabled={isSending}
            data-testid="button-send"
          >
            {isSending ? "Sending..." : "Send Notification"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
