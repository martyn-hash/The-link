import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Bell, Loader2 } from "lucide-react";
import type { Client } from "@shared/schema";
import { z } from "zod";
import EntitySearch, { type SelectedEntity } from "@/components/entity-search";

const reminderFormSchema = z.object({
  title: z.string().min(1, "Reminder name is required"),
  description: z.string().optional(),
  dueDate: z.string().min(1, "Date is required"),
  dueTime: z.string().min(1, "Time is required"),
});

type ReminderFormData = z.infer<typeof reminderFormSchema>;

interface CreateReminderDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultValues?: Partial<ReminderFormData>;
  defaultClientId?: string;
  onSuccess?: () => void;
}

export function CreateReminderDialog({
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultValues,
  defaultClientId,
  onSuccess,
}: CreateReminderDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;
  
  const [selectedEntities, setSelectedEntities] = useState<SelectedEntity[]>([]);
  const hasHydratedRef = useRef(false);

  const { data: preselectedClient } = useQuery<Client>({
    queryKey: [`/api/clients/${defaultClientId}`],
    enabled: !!defaultClientId && open,
  });

  const form = useForm<ReminderFormData>({
    resolver: zodResolver(reminderFormSchema),
    mode: "onChange",
    defaultValues: {
      title: defaultValues?.title || "",
      description: defaultValues?.description || "",
      dueDate: defaultValues?.dueDate || "",
      dueTime: defaultValues?.dueTime || "09:00",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        title: defaultValues?.title || "",
        description: defaultValues?.description || "",
        dueDate: defaultValues?.dueDate || "",
        dueTime: defaultValues?.dueTime || "09:00",
      });
    }
  }, [open, defaultValues, form]);

  useEffect(() => {
    if (!open) {
      hasHydratedRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (hasHydratedRef.current) return;
    
    if (defaultClientId) {
      setSelectedEntities([{
        id: defaultClientId,
        type: 'client',
        label: preselectedClient?.name || 'Selected Client'
      }]);
    } else {
      setSelectedEntities([]);
    }
    hasHydratedRef.current = true;
  }, [open, defaultClientId, preselectedClient]);

  const createReminderMutation = useMutation({
    mutationFn: async (data: ReminderFormData) => {
      const dueDateTimeStr = `${data.dueDate}T${data.dueTime}:00`;
      const dueDateTime = new Date(dueDateTimeStr);

      const currentUserId = user?.id;
      if (!currentUserId) {
        throw new Error("You must be logged in to create a reminder");
      }

      const reminder = await apiRequest("POST", "/api/internal-tasks", {
        title: data.title,
        description: data.description || "",
        priority: "low",
        status: "open",
        assignedTo: currentUserId,
        dueDate: dueDateTime.toISOString(),
        isQuickReminder: true,
      });

      if (selectedEntities.length > 0) {
        const connectionList = selectedEntities.map(entity => ({
          entityType: entity.type,
          entityId: entity.id
        }));

        await apiRequest("POST", `/api/internal-tasks/${reminder.id}/connections`, {
          connections: connectionList,
        });
      }

      return reminder;
    },
    onSuccess: () => {
      toast({
        title: "Reminder created",
        description: "Your reminder has been set.",
      });
      
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/internal-tasks');
        }
      });
      
      form.reset();
      setSelectedEntities([]);
      setOpen(false);
      
      onSuccess?.();
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const onSubmit = (data: ReminderFormData) => {
    createReminderMutation.mutate(data);
  };

  const dialogContent = (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Create Reminder
        </DialogTitle>
        <DialogDescription>
          Set a quick reminder for yourself.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reminder Name *</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="What do you need to remember?"
                    data-testid="input-reminder-title"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Details</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Add any additional details..."
                    rows={2}
                    data-testid="input-reminder-description"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="date"
                      data-testid="input-reminder-date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dueTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="time"
                      data-testid="input-reminder-time"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="border-t pt-4 mt-4">
            <p className="text-sm text-muted-foreground mb-2">
              Link to a client or project (optional)
            </p>
            <EntitySearch
              placeholder="Search for a client or project..."
              selectedEntities={selectedEntities}
              onSelect={(entity) => setSelectedEntities([...selectedEntities, entity])}
              onRemove={(entityId) => setSelectedEntities(selectedEntities.filter(e => e.id !== entityId))}
              allowMultiple={true}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createReminderMutation.isPending}
              data-testid="button-cancel-reminder"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createReminderMutation.isPending}
              data-testid="button-create-reminder"
            >
              {createReminderMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Set Reminder
            </Button>
          </div>
        </form>
      </Form>
    </DialogContent>
  );

  if (trigger) {
    return (
      <Dialog open={open} onOpenChange={setOpen} modal={false}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen} modal={false}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-create-reminder-trigger">
          <Bell className="w-4 h-4 mr-2" />
          Set Reminder
        </Button>
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
}
