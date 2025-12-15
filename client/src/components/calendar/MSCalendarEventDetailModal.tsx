import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Video,
  ExternalLink,
  Trash2,
  Loader2,
  User,
  Pencil,
  X,
  Save,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { MSCalendarEvent } from "@shared/schema";
import { updateMeetingSchema, type UpdateMeetingInput } from "@shared/schema";

interface MSCalendarEventDetailModalProps {
  event: MSCalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId?: string;
}

export function MSCalendarEventDetailModal({
  event,
  open,
  onOpenChange,
  currentUserId,
}: MSCalendarEventDetailModalProps) {
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<UpdateMeetingInput>({
    resolver: zodResolver(updateMeetingSchema),
    defaultValues: {
      subject: "",
      description: "",
      startDateTime: "",
      endDateTime: "",
      location: "",
      showAs: "busy",
      isTeamsMeeting: false,
    },
  });

  const stripHtml = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
  };

  useEffect(() => {
    if (event && isEditing) {
      let description = "";
      if (event.body?.content) {
        description = event.body.contentType === "html" 
          ? stripHtml(event.body.content)
          : event.body.content;
      }
      
      const extractDateTimeLocal = (isoString: string): string => {
        const match = isoString.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
        if (match) {
          return `${match[1]}T${match[2]}`;
        }
        return isoString.slice(0, 16);
      };
      
      form.reset({
        subject: event.subject || "",
        description,
        startDateTime: extractDateTimeLocal(event.start.dateTime),
        endDateTime: extractDateTimeLocal(event.end.dateTime),
        location: event.location?.displayName || "",
        showAs: event.showAs as UpdateMeetingInput["showAs"] || "busy",
        isTeamsMeeting: event.isOnlineMeeting || false,
        timeZone: event.start.timeZone || "Europe/London",
      });
    }
  }, [event, isEditing, form]);

  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      await apiRequest("DELETE", `/api/ms-calendar/events/${eventId}`);
    },
    onSuccess: () => {
      toast({
        title: "Event deleted",
        description: "The calendar event has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ms-calendar/events'] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete event",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateMeetingInput) => {
      await apiRequest("PATCH", `/api/ms-calendar/events/${event!.id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Event updated",
        description: "The calendar event has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ms-calendar/events'] });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update event",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!event) return null;

  const formatTime = (dateTimeStr: string) => {
    try {
      const date = parseISO(dateTimeStr);
      return format(date, "h:mm a");
    } catch {
      return "";
    }
  };

  const formatDate = (dateTimeStr: string) => {
    try {
      const date = parseISO(dateTimeStr);
      return format(date, "EEEE, MMMM d, yyyy");
    } catch {
      return dateTimeStr;
    }
  };

  const isOwner = event.calendarOwnerId === currentUserId;
  const isOrganizer = event.organizer?.emailAddress?.address?.toLowerCase() === event.calendarOwnerEmail?.toLowerCase();
  const canEdit = isOwner || isOrganizer;

  const handleDelete = () => {
    if (event) {
      deleteMutation.mutate(event.id);
    }
  };

  const handleSave = (data: UpdateMeetingInput) => {
    const payload = { ...data };
    
    payload.timeZone = event.start.timeZone || "Europe/London";
    
    updateMutation.mutate(payload);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    form.reset();
  };

  const getShowAsColor = (showAs?: string) => {
    switch (showAs) {
      case "busy":
        return "bg-red-500";
      case "tentative":
        return "bg-yellow-500";
      case "free":
        return "bg-green-500";
      case "oof":
        return "bg-purple-500";
      default:
        return "bg-blue-500";
    }
  };

  const getShowAsLabel = (showAs?: string) => {
    switch (showAs) {
      case "busy":
        return "Busy";
      case "tentative":
        return "Tentative";
      case "free":
        return "Free";
      case "oof":
        return "Out of Office";
      case "workingElsewhere":
        return "Working Elsewhere";
      default:
        return "Unknown";
    }
  };

  const getAttendeeStatusIcon = (response?: string) => {
    switch (response) {
      case "accepted":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "declined":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "tentativelyAccepted":
        return <HelpCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getAttendeeStatusLabel = (response?: string) => {
    switch (response) {
      case "accepted":
        return "Accepted";
      case "declined":
        return "Declined";
      case "tentativelyAccepted":
        return "Tentative";
      case "none":
        return "No response";
      default:
        return "Pending";
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(newOpen) => {
        if (!newOpen) {
          setIsEditing(false);
          form.reset();
        }
        onOpenChange(newOpen);
      }}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] p-0 overflow-hidden" data-testid="ms-calendar-event-modal">
          {isEditing ? (
            <div className="p-6">
              <DialogHeader className="mb-6">
                <DialogTitle className="text-xl">Edit Event</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Event subject" data-testid="input-event-subject" />
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
                          <FormLabel>Start</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} data-testid="input-event-start" />
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
                          <FormLabel>End</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} data-testid="input-event-end" />
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
                          <Input {...field} placeholder="Add location" data-testid="input-event-location" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="showAs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Show As</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-event-showas">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="busy">Busy</SelectItem>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="tentative">Tentative</SelectItem>
                            <SelectItem value="oof">Out of Office</SelectItem>
                            <SelectItem value="workingElsewhere">Working Elsewhere</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isTeamsMeeting"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Teams Meeting</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Add a Teams meeting link
                          </p>
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
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Add description" 
                            rows={3}
                            data-testid="textarea-event-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelEdit}
                      data-testid="button-cancel-edit"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={updateMutation.isPending}
                      data-testid="button-save-event"
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          ) : (
            <>
              <div className={`px-6 pt-6 pb-4 border-b bg-gradient-to-r from-muted/50 to-background ${getShowAsColor(event.showAs)}/5`}>
                <div className="flex items-start gap-4">
                  <div
                    className={`w-4 h-4 rounded-full mt-1 flex-shrink-0 ${getShowAsColor(event.showAs)} shadow-sm`}
                  />
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-2xl font-semibold leading-tight mb-2" data-testid="text-event-subject">
                      {event.subject}
                    </DialogTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-xs font-medium">
                        {getShowAsLabel(event.showAs)}
                      </Badge>
                      {event.isOnlineMeeting && (
                        <Badge className="text-xs flex items-center gap-1 bg-blue-600 hover:bg-blue-700">
                          <Video className="h-3 w-3" />
                          Teams Meeting
                        </Badge>
                      )}
                      {event.isAllDay && (
                        <Badge variant="secondary" className="text-xs">
                          All Day
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-6 p-6">
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Date & Time</p>
                      <p className="font-medium text-base" data-testid="text-event-date">
                        {formatDate(event.start.dateTime)}
                      </p>
                      {!event.isAllDay && (
                        <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-event-time">
                          {formatTime(event.start.dateTime)} – {formatTime(event.end.dateTime)}
                        </p>
                      )}
                    </div>
                  </div>

                  {event.location?.displayName && (
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-orange-600" />
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Location</p>
                        {/^https?:\/\//i.test(event.location.displayName) ? (
                          <a 
                            href={event.location.displayName} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-medium text-primary hover:underline break-all"
                            data-testid="text-event-location"
                          >
                            {event.location.displayName}
                          </a>
                        ) : (
                          <p className="font-medium" data-testid="text-event-location">{event.location.displayName}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-violet-600" />
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Calendar</p>
                      <p className="font-medium" data-testid="text-calendar-owner">
                        {event.calendarOwnerName}
                      </p>
                    </div>
                  </div>

                  {event.organizer && (
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Organizer</p>
                        <p className="font-medium" data-testid="text-organizer">
                          {event.organizer.emailAddress?.name || event.organizer.emailAddress?.address}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 md:mt-0">
                  {event.attendees && event.attendees.length > 0 ? (
                    <div className="rounded-xl border bg-muted/30 p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <span className="font-semibold">Attendees</span>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {event.attendees.length}
                        </Badge>
                      </div>
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                          {event.attendees.map((attendee, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                                {(attendee.emailAddress.name || attendee.emailAddress.address)?.[0]?.toUpperCase() || "?"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {attendee.emailAddress.name || attendee.emailAddress.address}
                                </p>
                                {attendee.emailAddress.name && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {attendee.emailAddress.address}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                {getAttendeeStatusIcon(attendee.status?.response)}
                                <span className="text-xs text-muted-foreground hidden sm:inline">
                                  {getAttendeeStatusLabel(attendee.status?.response)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center">
                      <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No attendees</p>
                    </div>
                  )}
                </div>
              </div>

              {event.body?.content && (
                <div className="px-6 pb-4">
                  <Separator className="mb-4" />
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Description</p>
                  </div>
                  <div
                    className="text-sm prose prose-sm max-w-none dark:prose-invert bg-muted/30 rounded-lg p-4"
                    dangerouslySetInnerHTML={{
                      __html: event.body.contentType === "html" 
                        ? event.body.content 
                        : event.body.content.replace(/\n/g, "<br />"),
                    }}
                    data-testid="text-event-description"
                  />
                </div>
              )}

              <DialogFooter className="px-6 py-4 border-t bg-muted/30 gap-2 flex-wrap sm:flex-nowrap">
                <div className="flex gap-2 flex-1 flex-wrap sm:flex-nowrap">
                  {event.onlineMeeting?.joinUrl && (
                    <Button
                      className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                      onClick={() => window.open(event.onlineMeeting!.joinUrl, "_blank")}
                      data-testid="button-join-teams"
                    >
                      <Video className="h-4 w-4 mr-2" />
                      Join Teams
                    </Button>
                  )}

                  {event.webLink && (
                    <Button
                      variant="outline"
                      onClick={() => window.open(event.webLink, "_blank")}
                      data-testid="button-open-outlook"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open in Outlook
                    </Button>
                  )}
                </div>

                {canEdit && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                      data-testid="button-edit-event"
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={deleteMutation.isPending}
                      data-testid="button-delete-event"
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent data-testid="alert-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{event.subject}" from your calendar.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
