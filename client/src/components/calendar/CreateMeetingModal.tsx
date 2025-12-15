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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Loader2, Video, X, Plus, Calendar, MapPin, Users, Clock, CalendarDays } from "lucide-react";
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
    setAttendeeInput("");
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
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] p-0 overflow-hidden" data-testid="create-meeting-modal">
        <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-primary/5 to-background">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <DialogTitle className="text-2xl font-semibold" data-testid="text-modal-title">
                Create Meeting
              </DialogTitle>
            </div>
          </DialogHeader>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-5">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Event Details</span>
                </div>

                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Subject *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Meeting subject"
                          className="h-11"
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
                      <FormLabel className="text-sm font-medium">Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Add meeting details, agenda, or notes..."
                          rows={4}
                          className="resize-none"
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
                        <FormLabel className="text-sm font-medium">Start *</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            {...field}
                            className="h-11"
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
                        <FormLabel className="text-sm font-medium">End *</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            {...field}
                            className="h-11"
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
                      <FormLabel className="text-sm font-medium flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        Location
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Add location or meeting room"
                          className="h-11"
                          data-testid="input-location"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-5">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Attendees & Settings</span>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Invite Attendees</Label>
                  <div className="flex gap-2">
                    <Input
                      value={attendeeInput}
                      onChange={(e) => setAttendeeInput(e.target.value)}
                      placeholder="Enter email or search users..."
                      className="h-11"
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
                      className="h-11 w-11 flex-shrink-0"
                      onClick={handleAddAttendee}
                      data-testid="button-add-attendee"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {attendeeInput && filteredUsers && filteredUsers.length > 0 && (
                    <div className="border rounded-lg overflow-hidden shadow-sm">
                      <ScrollArea className="max-h-32">
                        {filteredUsers.slice(0, 5).map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            className="w-full px-4 py-3 text-left hover:bg-muted/50 text-sm border-b last:border-b-0 flex items-center gap-3 transition-colors"
                            onClick={() => handleSelectUser(user)}
                            data-testid={`button-select-user-${user.id}`}
                          >
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary flex-shrink-0">
                              {user.firstName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium block truncate">
                                {user.firstName} {user.lastName}
                              </span>
                              <span className="text-muted-foreground text-xs truncate block">{user.email}</span>
                            </div>
                          </button>
                        ))}
                      </ScrollArea>
                    </div>
                  )}

                  {attendeeEmails.length > 0 && (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="flex flex-wrap gap-2">
                        {attendeeEmails.map((email) => (
                          <Badge
                            key={email}
                            variant="secondary"
                            className="flex items-center gap-1.5 py-1.5 px-3"
                          >
                            <span className="truncate max-w-[150px]">{email}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveAttendee(email)}
                              className="hover:text-destructive transition-colors ml-1"
                              data-testid={`button-remove-attendee-${email}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {attendeeEmails.length === 0 && !attendeeInput && (
                    <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-center">
                      <Users className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No attendees added yet</p>
                    </div>
                  )}
                </div>

                <Separator className="my-4" />

                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="isTeamsMeeting"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-xl border p-4 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-600/10 flex items-center justify-center">
                            <Video className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <FormLabel className="text-base font-medium cursor-pointer">
                              Teams Meeting
                            </FormLabel>
                            <p className="text-sm text-muted-foreground">
                              Add a video call link
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
                      <FormItem className="flex items-center justify-between rounded-xl border p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                            <CalendarDays className="h-5 w-5 text-orange-600" />
                          </div>
                          <div>
                            <FormLabel className="text-base font-medium cursor-pointer">All Day Event</FormLabel>
                            <p className="text-sm text-muted-foreground">
                              Spans the entire day
                            </p>
                          </div>
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
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t bg-muted/30 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="px-6"
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMeetingMutation.isPending}
                className="px-6 min-w-[140px]"
                data-testid="button-create-meeting"
              >
                {createMeetingMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Calendar className="mr-2 h-4 w-4" />
                    Create Meeting
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
