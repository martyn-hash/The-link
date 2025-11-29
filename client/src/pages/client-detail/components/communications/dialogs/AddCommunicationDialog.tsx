import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TiptapEditor } from "@/components/TiptapEditor";
import { AudioRecorder } from "@/components/AudioRecorder";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { insertCommunicationSchema } from "@shared/schema";
import { formatPersonName } from "../../../utils/formatters";
import type { AddCommunicationDialogProps } from "../types";

const addCommunicationSchema = insertCommunicationSchema.extend({
  type: z.enum(['phone_call', 'note', 'sms_sent', 'sms_received', 'email_sent', 'email_received']),
}).omit({ userId: true });

type AddCommunicationFormValues = z.infer<typeof addCommunicationSchema>;

export function AddCommunicationDialog({ 
  clientId, 
  clientPeople,
  isOpen, 
  onClose,
  onSuccess 
}: AddCommunicationDialogProps) {
  const { toast } = useToast();

  const form = useForm<AddCommunicationFormValues>({
    resolver: zodResolver(addCommunicationSchema),
    defaultValues: {
      clientId,
      type: 'note' as const,
      subject: '',
      content: '',
      personId: undefined,
      actualContactTime: new Date(),
    },
  });

  const addCommunicationMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', `/api/communications`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communications/client', clientId] });
      onClose();
      form.reset();
      toast({
        title: "Communication added",
        description: "The communication has been logged successfully.",
      });
      onSuccess?.();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const onSubmit = (values: AddCommunicationFormValues) => {
    const formData = {
      ...values,
      personId: values.personId === 'none' ? null : values.personId
    };
    addCommunicationMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
        form.reset();
      }
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Communication</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Communication Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-communication-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="phone_call">Phone Call</SelectItem>
                        <SelectItem value="note">Note</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="personId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'none'}>
                      <FormControl>
                        <SelectTrigger data-testid="select-person">
                          <SelectValue placeholder="Select person" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No specific person</SelectItem>
                        {clientPeople?.map((cp: any) => (
                          <SelectItem key={cp.person.id} value={cp.person.id}>
                            {formatPersonName(cp.person.fullName)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Brief description or call purpose"
                      data-testid="input-subject"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <div data-testid="editor-content">
                      <TiptapEditor
                        content={field.value || ''}
                        onChange={field.onChange}
                        placeholder="Enter communication details, call notes, or message content..."
                        editorHeight="min-h-[200px]"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Record detailed notes about the communication
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center gap-2 pt-2 border-t">
              <AudioRecorder
                mode="notes"
                disabled={addCommunicationMutation.isPending}
                onResult={(result) => {
                  form.setValue('content', result.content);
                }}
              />
              <span className="text-xs text-muted-foreground">
                Record voice notes and AI will create a summary
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onClose();
                  form.reset();
                }}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addCommunicationMutation.isPending}
                data-testid="button-save-communication"
              >
                {addCommunicationMutation.isPending ? 'Saving...' : 'Save Communication'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
