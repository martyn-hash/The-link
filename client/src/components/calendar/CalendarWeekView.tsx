import { useMemo, useState } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  format,
  parseISO,
} from "date-fns";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Video, Calendar } from "lucide-react";
import CalendarDayModal from "./CalendarDayModal";
import type { CalendarEvent as CalendarEventType } from "@shared/schema";

interface CalendarWeekViewProps {
  currentDate: Date;
  events: CalendarEventType[];
  onEventClick: (event: CalendarEventType) => void;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface CategorySummary {
  name: string;
  count: number;
  color: string;
  type: "service" | "stage" | "target" | "task";
}

function isOutlookEvent(event: CalendarEventType): boolean {
  return event.id.startsWith('ms_') || Boolean(event.meta?.isMsCalendar);
}

function groupEventsByCategory(events: CalendarEventType[]): CategorySummary[] {
  const serviceMap = new Map<string, { count: number; color: string }>();
  let stageCount = 0;
  let targetCount = 0;
  let taskCount = 0;

  events.forEach((event) => {
    if (isOutlookEvent(event)) {
      return;
    }
    if (event.type === "project_due") {
      const serviceName = event.meta?.serviceName || "Other";
      const existing = serviceMap.get(serviceName) || { count: 0, color: event.color };
      existing.count++;
      serviceMap.set(serviceName, existing);
    } else if (event.type === "stage_deadline") {
      stageCount++;
    } else if (event.type === "project_target") {
      targetCount++;
    } else if (event.type === "task_due") {
      taskCount++;
    }
  });

  const summaries: CategorySummary[] = [];

  serviceMap.forEach((value, key) => {
    summaries.push({
      name: key,
      count: value.count,
      color: value.color,
      type: "service",
    });
  });

  if (stageCount > 0) {
    summaries.push({
      name: "Stage Deadlines",
      count: stageCount,
      color: "#f59e0b",
      type: "stage",
    });
  }

  if (targetCount > 0) {
    summaries.push({
      name: "Target Dates",
      count: targetCount,
      color: "#3b82f6",
      type: "target",
    });
  }

  if (taskCount > 0) {
    summaries.push({
      name: "Tasks",
      count: taskCount,
      color: "#10b981",
      type: "task",
    });
  }

  return summaries.sort((a, b) => b.count - a.count);
}

function getOutlookEvents(events: CalendarEventType[]): CalendarEventType[] {
  return events
    .filter(isOutlookEvent)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function formatEventTime(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, "h:mm a");
  } catch {
    return "";
  }
}

export default function CalendarWeekView({
  currentDate,
  events,
  onEventClick,
}: CalendarWeekViewProps) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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

  const handleDayClick = (day: Date, dayEvents: CalendarEventType[]) => {
    const nonOutlookEvents = dayEvents.filter(e => !isOutlookEvent(e));
    if (nonOutlookEvents.length > 0) {
      setSelectedDay(day);
      setModalOpen(true);
    }
  };

  const selectedDayEvents = selectedDay 
    ? (eventsByDay.get(format(selectedDay, "yyyy-MM-dd")) || []).filter(e => !isOutlookEvent(e))
    : [];

  return (
    <>
      <div className="flex flex-col h-full bg-card rounded-lg border-2 border-border shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/50 border-b-2 border-border">
          {weekDays.map((day, index) => {
            const isToday = isSameDay(day, today);
            const dayKey = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDay.get(dayKey) || [];
            const projectTaskEvents = dayEvents.filter(e => !isOutlookEvent(e));
            const projectTaskCount = projectTaskEvents.length;
            
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "py-4 text-center border-r-2 border-border last:border-r-0 transition-colors",
                  isToday && "bg-primary/10"
                )}
              >
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                  {WEEKDAYS[index]}
                </div>
                <div
                  className={cn(
                    "text-2xl font-bold mt-1 transition-colors",
                    isToday && "text-primary"
                  )}
                >
                  {format(day, "d")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(day, "MMM")}
                </div>
                {projectTaskCount > 0 && (
                  <button
                    onClick={() => handleDayClick(day, projectTaskEvents)}
                    className={cn(
                      "mt-2 text-xs font-medium px-2 py-1 rounded-full transition-all",
                      "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                    )}
                    data-testid={`calendar-week-see-more-${dayKey}`}
                  >
                    {projectTaskCount} items
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-7 flex-1">
          {weekDays.map((day) => {
            const isToday = isSameDay(day, today);
            const dayKey = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDay.get(dayKey) || [];
            const categories = groupEventsByCategory(dayEvents);
            const outlookEvents = getOutlookEvents(dayEvents);
            const projectEventsCount = dayEvents.filter(e => !isOutlookEvent(e)).length;
            const hasContent = categories.length > 0 || outlookEvents.length > 0;

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "border-r-2 border-border last:border-r-0 min-h-[350px] transition-colors group",
                  isToday && "bg-primary/5"
                )}
                data-testid={`calendar-week-day-${dayKey}`}
              >
                <ScrollArea className="h-full p-3">
                  <div className="space-y-2">
                    {!hasContent ? (
                      <div className="text-xs text-muted-foreground text-center py-8">
                        No events
                      </div>
                    ) : (
                      <>
                        {outlookEvents.map((event) => {
                          const msEvent = event.meta?.msCalendarEvent;
                          const isTeamsMeeting = msEvent?.isOnlineMeeting;
                          const eventColor = event.color || "#0078d4";
                          
                          return (
                            <button
                              key={event.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEventClick(event);
                              }}
                              className={cn(
                                "w-full text-left p-2 rounded-lg border transition-all",
                                "hover:shadow-md hover:scale-[1.02] cursor-pointer",
                                "bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-950/30 dark:to-transparent"
                              )}
                              style={{
                                borderLeftWidth: "3px",
                                borderLeftColor: eventColor,
                              }}
                              data-testid={`calendar-outlook-event-${event.id}`}
                            >
                              <div className="flex items-start gap-2">
                                <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium text-foreground truncate">
                                    {event.title}
                                  </div>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[10px] text-muted-foreground">
                                      {formatEventTime(event.date)}
                                    </span>
                                    {isTeamsMeeting && (
                                      <Video className="h-2.5 w-2.5 text-blue-500" />
                                    )}
                                  </div>
                                  {event.assigneeName && event.assigneeName !== "My Calendar" && (
                                    <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                                      {event.assigneeName}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}

                        {categories.map((category, i) => (
                          <div
                            key={`${category.name}-${i}`}
                            onClick={() => handleDayClick(day, dayEvents.filter(e => !isOutlookEvent(e)))}
                            className="p-2 rounded-lg border transition-colors hover:bg-accent/50 cursor-pointer"
                            style={{ 
                              borderLeftWidth: "3px",
                              borderLeftColor: category.color 
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-lg text-foreground">
                                {category.count}
                              </span>
                              <span className="text-sm text-muted-foreground truncate">
                                {category.name}
                              </span>
                            </div>
                          </div>
                        ))}
                        
                        {projectEventsCount > 0 && (
                          <button
                            className={cn(
                              "w-full text-center py-2 text-xs font-medium rounded-lg transition-all",
                              "bg-muted/50 text-muted-foreground hover:bg-primary hover:text-primary-foreground",
                              "opacity-0 group-hover:opacity-100"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDayClick(day, dayEvents.filter(e => !isOutlookEvent(e)));
                            }}
                          >
                            See all {projectEventsCount} items
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      </div>

      <CalendarDayModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        date={selectedDay}
        events={selectedDayEvents}
        onEventClick={onEventClick}
      />
    </>
  );
}
