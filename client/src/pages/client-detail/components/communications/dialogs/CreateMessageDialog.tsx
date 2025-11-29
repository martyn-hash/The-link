import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import type { CreateMessageDialogProps } from "../types";

export function CreateMessageDialog({ 
  clientId, 
  isOpen, 
  onClose,
  onSuccess 
}: CreateMessageDialogProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const createMessageThreadMutation = useMutation({
    mutationFn: (data: { subject: string; content: string; clientId: string }) =>
      apiRequest('POST', '/api/internal/messages/threads', data),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/internal/messages/threads/client', clientId] });
      onClose();
      toast({
        title: "Message thread created",
        description: "The message has been sent to the client.",
      });
      onSuccess?.();
      if (response?.id) {
        setLocation(`/messages?thread=${response.id}`);
      }
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMessageThreadMutation.mutate({
      subject: formData.get('subject') as string,
      content: formData.get('content') as string,
      clientId: clientId,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Create Instant Message
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Start a new secure message thread with the client
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="subject" className="text-sm font-medium">Subject</label>
              <Input
                id="subject"
                name="subject"
                placeholder="e.g., Document request, Account update..."
                required
                data-testid="input-message-subject"
              />
            </div>
            <div>
              <label htmlFor="content" className="text-sm font-medium">Initial Message</label>
              <textarea
                id="content"
                name="content"
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Type your message here..."
                required
                data-testid="input-message-content"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMessageThreadMutation.isPending} data-testid="button-send-message">
              {createMessageThreadMutation.isPending ? 'Creating...' : 'Create & Send'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
