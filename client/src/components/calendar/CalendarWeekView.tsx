import { useMemo } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  format,
} from "date-fns";
import { cn } from "@/lib/utils";
import CalendarEvent from "./CalendarEvent";
import type { CalendarEvent as CalendarEventType } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CalendarWeekViewProps {
  currentDate: Date;
  events: CalendarEventType[];
  onEventClick: (event: CalendarEventType) => void;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function CalendarWeekView({
  currentDate,
  events,
  onEventClick,
}: CalendarWeekViewProps) {
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate);
    const weekEnd = endOfWeek(currentDate);
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentDate]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventType[]>();
    
    events.forEach((event) => {
      const eventDate = new Date(event.date);
      const key = format(eventDate, "yyyy-MM-dd");
      const existing = map.get(key) || [];
      existing.push(event);
      map.set(key, existing);
    });

    return map;
  }, [events]);

  const today = new Date();

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-7 border-b">
        {weekDays.map((day, index) => {
          const isToday = isSameDay(day, today);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "py-3 text-center border-r last:border-r-0",
                isToday && "bg-primary/5"
              )}
            >
              <div className="text-sm text-muted-foreground">
                {WEEKDAYS[index]}
              </div>
              <div
                className={cn(
                  "text-lg font-semibold mt-1",
                  isToday && "text-primary"
                )}
              >
                {format(day, "d")}
              </div>
              <div className="text-xs text-muted-foreground">
                {format(day, "MMM")}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-7 flex-1">
        {weekDays.map((day) => {
          const isToday = isSameDay(day, today);
          const dayKey = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDay.get(dayKey) || [];

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "border-r last:border-r-0 min-h-[300px]",
                isToday && "bg-primary/5"
              )}
              data-testid={`calendar-week-day-${dayKey}`}
            >
              <ScrollArea className="h-full p-2">
                <div className="space-y-1">
                  {dayEvents.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-4">
                      No events
                    </div>
                  ) : (
                    dayEvents.map((event) => (
                      <CalendarEvent
                        key={event.id}
                        event={event}
                        onClick={onEventClick}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
}
