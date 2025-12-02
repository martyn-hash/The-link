import { useMemo, useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
} from "date-fns";
import { cn } from "@/lib/utils";
import CalendarDayModal from "./CalendarDayModal";
import type { CalendarEvent as CalendarEventType } from "@shared/schema";

interface CalendarMonthViewProps {
  currentDate: Date;
  events: CalendarEventType[];
  onEventClick: (event: CalendarEventType) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CategorySummary {
  name: string;
  count: number;
  color: string;
  type: "service" | "stage" | "target" | "task";
}

function groupEventsByCategory(events: CalendarEventType[]): CategorySummary[] {
  const serviceMap = new Map<string, { count: number; color: string }>();
  let stageCount = 0;
  let targetCount = 0;
  let taskCount = 0;

  events.forEach((event) => {
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

export default function CalendarMonthView({
  currentDate,
  events,
  onEventClick,
}: CalendarMonthViewProps) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
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
    if (dayEvents.length > 0) {
      setSelectedDay(day);
      setModalOpen(true);
    }
  };

  const selectedDayEvents = selectedDay 
    ? eventsByDay.get(format(selectedDay, "yyyy-MM-dd")) || []
    : [];

  return (
    <>
      <div className="flex flex-col h-full bg-card rounded-lg border-2 border-border shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/50 border-b-2 border-border">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="py-3 text-center text-sm font-semibold text-foreground uppercase tracking-wide border-r-2 border-border last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 flex-1 auto-rows-fr">
          {calendarDays.map((day, index) => {
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, today);
            const dayKey = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDay.get(dayKey) || [];
            const categories = groupEventsByCategory(dayEvents);
            const totalEvents = dayEvents.length;
            const isLastRow = index >= calendarDays.length - 7;

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[120px] border-r-2 border-border p-2 transition-colors relative group",
                  !isCurrentMonth && "bg-muted/20",
                  isCurrentMonth && "bg-card hover:bg-accent/30",
                  index % 7 === 6 && "border-r-0",
                  !isLastRow && "border-b-2",
                  totalEvents > 0 && "cursor-pointer"
                )}
                data-testid={`calendar-day-${dayKey}`}
                onClick={() => handleDayClick(day, dayEvents)}
              >
                <div className="flex items-start justify-between mb-2">
                  <span
                    className={cn(
                      "text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full transition-colors",
                      !isCurrentMonth && "text-muted-foreground/50",
                      isCurrentMonth && "text-foreground",
                      isToday && "bg-primary text-primary-foreground shadow-md"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {totalEvents > 0 && (
                    <button
                      className={cn(
                        "text-xs font-medium px-2 py-1 rounded-full transition-all",
                        "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground",
                        "opacity-0 group-hover:opacity-100"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDayClick(day, dayEvents);
                      }}
                      data-testid={`calendar-day-see-more-${dayKey}`}
                    >
                      See all
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  {categories.slice(0, 4).map((category, i) => (
                    <div
                      key={`${category.name}-${i}`}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="font-semibold text-foreground min-w-[20px]">
                        {category.count}
                      </span>
                      <span className="text-muted-foreground truncate">
                        {category.name}
                      </span>
                    </div>
                  ))}
                  {categories.length > 4 && (
                    <div className="text-xs text-muted-foreground pl-3.5">
                      +{categories.length - 4} more categories
                    </div>
                  )}
                </div>
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
