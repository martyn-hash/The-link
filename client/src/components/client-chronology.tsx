import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import type { SelectClientChronology, User } from "@shared/schema";

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
  // State for live time updates
  const [currentTime, setCurrentTime] = useState(Date.now());

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
    <ScrollArea className="h-[600px] pr-4" data-testid="client-chronology-scroll">
      <div className="space-y-4">
        {sortedChronology.map((entry) => (
          <div
            key={entry.id}
            className="border rounded-lg p-4 bg-card hover:bg-muted/50 transition-colors"
            data-testid={`chronology-entry-${entry.id}`}
          >
            <div className="flex flex-col gap-3">
              {/* Header with timestamp and event type */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
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
                <span 
                  className="text-sm text-muted-foreground"
                  data-testid={`timestamp-${entry.id}`}
                >
                  {entry.timestamp 
                    ? formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })
                    : 'Unknown time'
                  }
                </span>
              </div>

              {/* Change reason */}
              {entry.changeReason && (
                <div data-testid={`change-reason-${entry.id}`}>
                  <p className="text-sm font-medium text-foreground">
                    {entry.changeReason}
                  </p>
                </div>
              )}

              {/* Value change display */}
              {entry.fromValue !== null && entry.toValue !== null && (
                <div className="flex items-center gap-2 text-sm" data-testid={`value-change-${entry.id}`}>
                  <span className="text-muted-foreground">Changed from:</span>
                  <Badge variant="outline">{entry.fromValue}</Badge>
                  <span className="text-muted-foreground">to:</span>
                  <Badge variant="outline">{entry.toValue}</Badge>
                </div>
              )}

              {/* User attribution */}
              {entry.user && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid={`user-attribution-${entry.id}`}>
                  <span>Changed by:</span>
                  <span className="font-medium">
                    {entry.user.firstName} {entry.user.lastName}
                  </span>
                  {entry.user.email && (
                    <span className="text-muted-foreground">({entry.user.email})</span>
                  )}
                </div>
              )}

              {/* Notes if present */}
              {entry.notes && (
                <div className="mt-2 p-2 bg-muted/30 rounded text-sm" data-testid={`notes-${entry.id}`}>
                  <span className="font-medium text-muted-foreground">Notes:</span>
                  <p className="mt-1">{entry.notes}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}