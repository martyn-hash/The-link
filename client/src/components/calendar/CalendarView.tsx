import { useState, useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  format,
} from "date-fns";
import { Loader2 } from "lucide-react";
import CalendarHeader from "./CalendarHeader";
import CalendarMonthView from "./CalendarMonthView";
import CalendarWeekView from "./CalendarWeekView";
import { useCalendarEvents } from "./useCalendarEvents";
import type { CalendarEvent, CalendarViewSettings } from "@shared/schema";

interface CalendarViewProps {
  serviceFilter?: string;
  taskAssigneeFilter?: string;
  serviceOwnerFilter?: string;
  userFilter?: string;
  showArchived?: boolean;
  onEventClick: (event: CalendarEvent) => void;
  initialSettings?: CalendarViewSettings;
  onSettingsChange?: (settings: CalendarViewSettings) => void;
}

export default function CalendarView({
  serviceFilter = "all",
  taskAssigneeFilter = "all",
  serviceOwnerFilter = "all",
  userFilter = "all",
  showArchived = false,
  onEventClick,
  initialSettings,
  onSettingsChange,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<"month" | "week">(
    initialSettings?.calendarViewType || "month"
  );

  const [showProjectDues, setShowProjectDues] = useState(
    initialSettings?.showProjectDueDates ?? true
  );
  const [showTargetDates, setShowTargetDates] = useState(
    initialSettings?.showProjectTargetDates ?? true
  );
  const [showStageDeadlines, setShowStageDeadlines] = useState(
    initialSettings?.showStageDeadlines ?? false
  );
  const [showTasks, setShowTasks] = useState(
    initialSettings?.showTaskDueDates ?? true
  );

  const dateRange = useMemo(() => {
    if (viewType === "month") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart);
      const calendarEnd = endOfWeek(monthEnd);
      return {
        start: format(calendarStart, "yyyy-MM-dd"),
        end: format(calendarEnd, "yyyy-MM-dd"),
      };
    } else {
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(currentDate);
      return {
        start: format(weekStart, "yyyy-MM-dd"),
        end: format(weekEnd, "yyyy-MM-dd"),
      };
    }
  }, [currentDate, viewType]);

  const { data, isLoading, error } = useCalendarEvents({
    start: dateRange.start,
    end: dateRange.end,
    serviceFilter,
    taskAssigneeFilter,
    serviceOwnerFilter,
    userFilter,
    showArchived,
    includeProjectDues: showProjectDues,
    includeTargetDates: showTargetDates,
    includeStageDeadlines: showStageDeadlines,
    includeTasks: showTasks,
  });

  const handlePrevious = () => {
    if (viewType === "month") {
      setCurrentDate((prev) => subMonths(prev, 1));
    } else {
      setCurrentDate((prev) => subWeeks(prev, 1));
    }
  };

  const handleNext = () => {
    if (viewType === "month") {
      setCurrentDate((prev) => addMonths(prev, 1));
    } else {
      setCurrentDate((prev) => addWeeks(prev, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleViewTypeChange = (type: "month" | "week") => {
    setViewType(type);
    if (onSettingsChange) {
      onSettingsChange({
        calendarViewType: type,
        showProjectDueDates: showProjectDues,
        showProjectTargetDates: showTargetDates,
        showStageDeadlines,
        showTaskDueDates: showTasks,
      });
    }
  };

  const handleSettingChange = (
    setter: (value: boolean) => void,
    key: keyof CalendarViewSettings,
    value: boolean
  ) => {
    setter(value);
    if (onSettingsChange) {
      const settings: CalendarViewSettings = {
        calendarViewType: viewType,
        showProjectDueDates: key === "showProjectDueDates" ? value : showProjectDues,
        showProjectTargetDates: key === "showProjectTargetDates" ? value : showTargetDates,
        showStageDeadlines: key === "showStageDeadlines" ? value : showStageDeadlines,
        showTaskDueDates: key === "showTaskDueDates" ? value : showTasks,
      };
      onSettingsChange(settings);
    }
  };

  const events = data?.events || [];

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Failed to load calendar events. Please try again.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="calendar-view">
      <CalendarHeader
        currentDate={currentDate}
        viewType={viewType}
        onViewTypeChange={handleViewTypeChange}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
        showProjectDues={showProjectDues}
        setShowProjectDues={(v) => handleSettingChange(setShowProjectDues, "showProjectDueDates", v)}
        showTargetDates={showTargetDates}
        setShowTargetDates={(v) => handleSettingChange(setShowTargetDates, "showProjectTargetDates", v)}
        showStageDeadlines={showStageDeadlines}
        setShowStageDeadlines={(v) => handleSettingChange(setShowStageDeadlines, "showStageDeadlines", v)}
        showTasks={showTasks}
        setShowTasks={(v) => handleSettingChange(setShowTasks, "showTaskDueDates", v)}
      />

      <div className="flex-1 mt-4 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {viewType === "month" ? (
          <CalendarMonthView
            currentDate={currentDate}
            events={events}
            onEventClick={onEventClick}
          />
        ) : (
          <CalendarWeekView
            currentDate={currentDate}
            events={events}
            onEventClick={onEventClick}
          />
        )}
      </div>

      {events.length === 0 && !isLoading && (
        <div className="text-center text-muted-foreground py-8">
          No events found for this period. Try adjusting the filters or date range.
        </div>
      )}
    </div>
  );
}
