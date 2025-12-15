import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, addHours } from "date-fns";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Video, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { createMeetingSchema, type CreateMeetingInput, type User } from "@shared/schema";

const meetingFormSchema = createMeetingSchema.extend({
  attendeeInput: z.string().optional(),
});

type MeetingFormData = z.infer<typeof meetingFormSchema>;

interface CreateMeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  onSuccess?: () => void;
}

export function CreateMeetingModal({
  open,
  onOpenChange,
  defaultDate,
  onSuccess,
}: CreateMeetingModalProps) {
  const { toast } = useToast();
  const [attendeeEmails, setAttendeeEmails] = useState<string[]>([]);
  const [attendeeInput, setAttendeeInput] = useState("");

  const { data: users } = useQuery<User[]>({
    queryKey: ['/api/users'],
    staleTime: 60000,
  });

  const defaultStart = defaultDate || new Date();
  const defaultEnd = addHours(defaultStart, 1);

  const form = useForm<MeetingFormData>({
    resolver: zodResolver(meetingFormSchema),
    defaultValues: {
      subject: "",
      description: "",
      startDateTime: format(defaultStart, "yyyy-MM-dd'T'HH:mm"),
      endDateTime: format(defaultEnd, "yyyy-MM-dd'T'HH:mm"),
      timeZone: "Europe/London",
      location: "",
      attendeeEmails: [],
      isTeamsMeeting: false,
      isAllDay: false,
      reminderMinutes: 15,
    },
  });

  useEffect(() => {
    if (open && defaultDate) {
      const start = defaultDate;
      const end = addHours(start, 1);
      form.setValue("startDateTime", format(start, "yyyy-MM-dd'T'HH:mm"));
      form.setValue("endDateTime", format(end, "yyyy-MM-dd'T'HH:mm"));
    }
  }, [open, defaultDate, form]);

  useEffect(() => {
    if (!open) {
      form.reset();
      setAttendeeEmails([]);
      setAttendeeInput("");
    }
  }, [open, form]);

  const createMeetingMutation = useMutation({
    mutationFn: async (data: CreateMeetingInput) => {
      const response = await apiRequest("POST", "/api/ms-calendar/events", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Meeting created",
        description: "Your meeting has been scheduled successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ms-calendar/events'] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create meeting",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddAttendee = () => {
    const email = attendeeInput.trim().toLowerCase();
    if (email && !attendeeEmails.includes(email)) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(email)) {
        setAttendeeEmails([...attendeeEmails, email]);
        setAttendeeInput("");
      } else {
        toast({
          title: "Invalid email",
          description: "Please enter a valid email address.",
          variant: "destructive",
        });
      }
    }
  };

  const handleRemoveAttendee = (email: string) => {
    setAttendeeEmails(attendeeEmails.filter((e) => e !== email));
  };

  const handleSelectUser = (user: User) => {
    if (user.email && !attendeeEmails.includes(user.email)) {
      setAttendeeEmails([...attendeeEmails, user.email]);
    }
  };

  const onSubmit = (data: MeetingFormData) => {
    const { attendeeInput: _, ...meetingData } = data;
    createMeetingMutation.mutate({
      ...meetingData,
      attendeeEmails: attendeeEmails.length > 0 ? attendeeEmails : undefined,
    });
  };

  const filteredUsers = users?.filter(
    (user) =>
      user.email &&
      !attendeeEmails.includes(user.email) &&
      (user.firstName?.toLowerCase().includes(attendeeInput.toLowerCase()) ||
        user.lastName?.toLowerCase().includes(attendeeInput.toLowerCase()) ||
        user.email.toLowerCase().includes(attendeeInput.toLowerCase()))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" data-testid="create-meeting-modal">
        <DialogHeader>
          <DialogTitle data-testid="text-modal-title">Create Meeting</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Meeting subject"
                      data-testid="input-subject"
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Add meeting details..."
                      rows={3}
                      data-testid="input-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDateTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start *</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        data-testid="input-start-datetime"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDateTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End *</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        data-testid="input-end-datetime"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Add location or meeting room"
                      data-testid="input-location"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Label>Attendees</Label>
              <div className="flex gap-2">
                <Input
                  value={attendeeInput}
                  onChange={(e) => setAttendeeInput(e.target.value)}
                  placeholder="Enter email or search users..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddAttendee();
                    }
                  }}
                  data-testid="input-attendee-email"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddAttendee}
                  data-testid="button-add-attendee"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {attendeeInput && filteredUsers && filteredUsers.length > 0 && (
                <div className="border rounded-md max-h-32 overflow-y-auto">
                  {filteredUsers.slice(0, 5).map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-muted text-sm"
                      onClick={() => handleSelectUser(user)}
                      data-testid={`button-select-user-${user.id}`}
                    >
                      <span className="font-medium">
                        {user.firstName} {user.lastName}
                      </span>
                      <span className="text-muted-foreground ml-2">{user.email}</span>
                    </button>
                  ))}
                </div>
              )}

              {attendeeEmails.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {attendeeEmails.map((email) => (
                    <Badge
                      key={email}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => handleRemoveAttendee(email)}
                        className="hover:text-destructive"
                        data-testid={`button-remove-attendee-${email}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="isTeamsMeeting"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-blue-600" />
                    <div>
                      <FormLabel className="text-base font-medium">
                        Teams Meeting
                      </FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Add a Microsoft Teams video call link
                      </p>
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-teams-meeting"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isAllDay"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel className="text-base font-medium">All Day Event</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Mark this as an all-day event
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-all-day"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMeetingMutation.isPending}
                data-testid="button-create-meeting"
              >
                {createMeetingMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Meeting
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
