import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import type { SelectClientChronology, User } from "@shared/schema";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Clock, User as UserIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface ClientChronologyProps {
  clientId: string;
}

type ClientChronologyEntry = SelectClientChronology & { user?: User };

// Helper function to format change reason for display
const formatChangeReason = (reason: string): string => {
  return reason
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Helper function to format event type for display
const formatEventType = (eventType: string): string => {
  return eventType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Helper function to format entity type for display  
const formatEntityType = (entityType: string): string => {
  switch (entityType) {
    case 'client_service':
      return 'Client Service';
    case 'people_service':
      return 'People Service';
    default:
      return entityType
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
  }
};

// Helper function to get badge variant based on event type
const getEventBadgeVariant = (eventType: string): "default" | "secondary" | "destructive" | "outline" => {
  if (eventType.includes('activated')) {
    return 'default'; // Green-ish for activations
  } else if (eventType.includes('deactivated')) {
    return 'secondary'; // Gray for deactivations
  } else {
    return 'outline'; // Default for other events
  }
};

export default function ClientChronology({ clientId }: ClientChronologyProps) {
  const isMobile = useIsMobile();
  // State for live time updates
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [selectedEntry, setSelectedEntry] = useState<ClientChronologyEntry | null>(null);
  const [isViewingEntry, setIsViewingEntry] = useState(false);

  // Update current time every minute for live time calculations
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Fetch chronology entries for this client
  const { data: chronologyEntries, isLoading } = useQuery<ClientChronologyEntry[]>({
    queryKey: ["/api/clients", clientId, "chronology"],
    enabled: !!clientId,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Memoize sorted chronology to avoid re-sorting on every render
  const sortedChronology = useMemo(() => {
    if (!chronologyEntries) return [];
    return [...chronologyEntries].sort((a, b) => {
      // Sort by timestamp in descending order (newest first)
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });
  }, [chronologyEntries]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!sortedChronology || sortedChronology.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No activity history available yet.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Service activations, deactivations, and other client events will appear here.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="client-chronology">
      {isMobile ? (
        /* Mobile Card View */
        <div className="space-y-3">
          {sortedChronology.map((entry) => (
            <Card key={entry.id} data-testid={`chronology-card-${entry.id}`}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Event & Entity Badges */}
                  <div className="flex flex-wrap gap-2">
                    <Badge 
                      variant={getEventBadgeVariant(entry.eventType)}
                      data-testid={`badge-event-type-${entry.id}`}
                    >
                      {formatEventType(entry.eventType)}
                    </Badge>
                    <Badge variant="outline" data-testid={`badge-entity-type-${entry.id}`}>
                      {formatEntityType(entry.entityType)}
                    </Badge>
                  </div>

                  {/* Time */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span data-testid={`text-timestamp-${entry.id}`}>
                      {entry.timestamp 
                        ? formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })
                        : 'Unknown time'
                      }
                    </span>
                  </div>

                  {/* User */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                    {entry.user ? (
                      <div className="flex items-center gap-2 text-sm" data-testid={`user-attribution-${entry.id}`}>
                        <UserIcon className="w-4 h-4 text-muted-foreground" />
                        <span data-testid={`text-user-${entry.id}`}>
                          {entry.user.firstName} {entry.user.lastName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground" data-testid={`text-no-user-${entry.id}`}>—</span>
                    )}
                  </div>

                  {/* View Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setSelectedEntry(entry);
                      setIsViewingEntry(true);
                    }}
                    data-testid={`button-view-chronology-${entry.id}`}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Desktop Table View */
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event Type</TableHead>
              <TableHead>Entity Type</TableHead>
              <TableHead>Date/Time</TableHead>
              <TableHead>Changed By</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedChronology.map((entry) => (
              <TableRow key={entry.id} data-testid={`chronology-row-${entry.id}`}>
                <TableCell data-testid={`cell-event-type-${entry.id}`}>
                  <Badge 
                    variant={getEventBadgeVariant(entry.eventType)}
                    data-testid={`badge-event-type-${entry.id}`}
                  >
                    {formatEventType(entry.eventType)}
                  </Badge>
                </TableCell>
                <TableCell data-testid={`cell-entity-type-${entry.id}`}>
                  <Badge variant="outline" data-testid={`badge-entity-type-${entry.id}`}>
                    {formatEntityType(entry.entityType)}
                  </Badge>
                </TableCell>
                <TableCell data-testid={`cell-timestamp-${entry.id}`}>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm" data-testid={`text-timestamp-${entry.id}`}>
                      {entry.timestamp 
                        ? formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })
                        : 'Unknown time'
                      }
                    </span>
                  </div>
                </TableCell>
                <TableCell data-testid={`cell-user-${entry.id}`}>
                  {entry.user ? (
                    <div className="flex items-center gap-2" data-testid={`user-attribution-${entry.id}`}>
                      <UserIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm" data-testid={`text-user-${entry.id}`}>
                        {entry.user.firstName} {entry.user.lastName}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground" data-testid={`text-no-user-${entry.id}`}>—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedEntry(entry);
                      setIsViewingEntry(true);
                    }}
                    data-testid={`button-view-chronology-${entry.id}`}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* View Chronology Detail Modal */}
      <Dialog open={isViewingEntry} onOpenChange={setIsViewingEntry}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Client Chronology Entry Details</DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              {/* Header Information */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <span className="text-xs text-muted-foreground">Event Type</span>
                  <div className="mt-1">
                    <Badge variant={getEventBadgeVariant(selectedEntry.eventType)} data-testid={`modal-badge-event-type-${selectedEntry.id}`}>
                      {formatEventType(selectedEntry.eventType)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Entity Type</span>
                  <div className="mt-1">
                    <Badge variant="outline" data-testid={`modal-badge-entity-type-${selectedEntry.id}`}>
                      {formatEntityType(selectedEntry.entityType)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Timestamp</span>
                  <div className="mt-1 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm" data-testid={`text-modal-timestamp-${selectedEntry.id}`}>
                      {selectedEntry.timestamp 
                        ? formatDistanceToNow(new Date(selectedEntry.timestamp), { addSuffix: true })
                        : 'Unknown time'}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Changed By</span>
                  <div className="mt-1">
                    {selectedEntry.user ? (
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm" data-testid={`text-modal-user-${selectedEntry.id}`}>
                          {selectedEntry.user.firstName} {selectedEntry.user.lastName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground" data-testid={`text-modal-no-user-${selectedEntry.id}`}>—</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Change Reason */}
              {selectedEntry.changeReason && (
                <div>
                  <span className="text-xs text-muted-foreground font-medium">Change Reason</span>
                  <p className="text-sm font-medium mt-2" data-testid={`text-modal-change-reason-${selectedEntry.id}`}>
                    {selectedEntry.changeReason}
                  </p>
                </div>
              )}

              {/* Value Changes */}
              {selectedEntry.fromValue !== null && selectedEntry.toValue !== null && (
                <div>
                  <span className="text-xs text-muted-foreground font-medium">Value Changes</span>
                  <div className="mt-2 p-3 bg-muted/30 rounded-lg" data-testid={`div-modal-value-change-${selectedEntry.id}`}>
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-xs text-muted-foreground">From:</span>
                        <Badge variant="outline" className="ml-2" data-testid={`badge-modal-from-value-${selectedEntry.id}`}>{selectedEntry.fromValue}</Badge>
                      </div>
                      <span className="text-muted-foreground">→</span>
                      <div>
                        <span className="text-xs text-muted-foreground">To:</span>
                        <Badge variant="outline" className="ml-2" data-testid={`badge-modal-to-value-${selectedEntry.id}`}>{selectedEntry.toValue}</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedEntry.notes && (
                <div>
                  <span className="text-xs text-muted-foreground font-medium">Notes</span>
                  <div className="mt-2 p-3 bg-muted/30 rounded-lg">
                    <p className="text-sm" data-testid={`text-modal-notes-${selectedEntry.id}`}>{selectedEntry.notes}</p>
                  </div>
                </div>
              )}

              {/* User Email */}
              {selectedEntry.user?.email && (
                <div>
                  <span className="text-xs text-muted-foreground font-medium">User Email</span>
                  <p className="text-sm text-muted-foreground mt-1" data-testid={`text-modal-user-email-${selectedEntry.id}`}>{selectedEntry.user.email}</p>
                </div>
              )}

              {/* Close Button */}
              <div className="flex justify-end pt-4">
                <Button
                  onClick={() => setIsViewingEntry(false)}
                  data-testid="button-close-chronology-detail"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}