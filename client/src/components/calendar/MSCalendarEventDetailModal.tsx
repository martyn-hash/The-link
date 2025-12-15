import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
  Calendar,
  Clock,
  MapPin,
  Users,
  Video,
  ExternalLink,
  Trash2,
  Loader2,
  User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { MSCalendarEvent } from "@shared/schema";

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

  if (!event) return null;

  const formatDateTime = (dateTimeStr: string) => {
    try {
      const date = parseISO(dateTimeStr);
      return format(date, "EEEE, MMMM d, yyyy 'at' h:mm a");
    } catch {
      return dateTimeStr;
    }
  };

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

  const handleDelete = () => {
    if (event) {
      deleteMutation.mutate(event.id);
    }
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" data-testid="ms-calendar-event-modal">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div
                className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${getShowAsColor(event.showAs)}`}
              />
              <div className="flex-1">
                <DialogTitle className="text-xl" data-testid="text-event-subject">
                  {event.subject}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {getShowAsLabel(event.showAs)}
                  </Badge>
                  {event.isOnlineMeeting && (
                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                      <Video className="h-3 w-3" />
                      Teams Meeting
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium" data-testid="text-event-date">
                  {formatDate(event.start.dateTime)}
                </p>
                {!event.isAllDay && (
                  <p className="text-sm text-muted-foreground" data-testid="text-event-time">
                    {formatTime(event.start.dateTime)} - {formatTime(event.end.dateTime)}
                  </p>
                )}
                {event.isAllDay && (
                  <p className="text-sm text-muted-foreground">All day</p>
                )}
              </div>
            </div>

            {event.location?.displayName && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <p data-testid="text-event-location">{event.location.displayName}</p>
              </div>
            )}

            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Calendar</p>
                <p className="font-medium" data-testid="text-calendar-owner">
                  {event.calendarOwnerName}
                </p>
              </div>
            </div>

            {event.organizer && (
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Organizer</p>
                  <p className="font-medium" data-testid="text-organizer">
                    {event.organizer.emailAddress?.name || event.organizer.emailAddress?.address}
                  </p>
                </div>
              </div>
            )}

            {event.attendees && event.attendees.length > 0 && (
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-2">
                    Attendees ({event.attendees.length})
                  </p>
                  <div className="space-y-1">
                    {event.attendees.map((attendee, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>
                          {attendee.emailAddress.name || attendee.emailAddress.address}
                        </span>
                        {attendee.status?.response && (
                          <Badge
                            variant={
                              attendee.status.response === "accepted"
                                ? "default"
                                : attendee.status.response === "declined"
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {attendee.status.response}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {event.body?.content && (
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">Description</p>
                <div
                  className="text-sm prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: event.body.contentType === "html" 
                      ? event.body.content 
                      : event.body.content.replace(/\n/g, "<br />"),
                  }}
                  data-testid="text-event-description"
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex-wrap gap-2">
            {event.onlineMeeting?.joinUrl && (
              <Button
                variant="default"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => window.open(event.onlineMeeting!.joinUrl, "_blank")}
                data-testid="button-join-teams"
              >
                <Video className="h-4 w-4 mr-2" />
                Join Teams Meeting
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

            {(isOwner || isOrganizer) && (
              <Button
                variant="destructive"
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
            )}
          </DialogFooter>
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
