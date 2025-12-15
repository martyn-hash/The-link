import { useState, useMemo, useEffect } from "react";
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
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import CalendarHeader, { type CalendarAccessUser } from "./CalendarHeader";
import CalendarMonthView from "./CalendarMonthView";
import CalendarWeekView from "./CalendarWeekView";
import { useCalendarEvents } from "./useCalendarEvents";
import { useOutlookCalendarEvents } from "./useOutlookCalendarEvents";
import { CreateMeetingModal } from "./CreateMeetingModal";
import { MSCalendarEventDetailModal } from "./MSCalendarEventDetailModal";
import type { CalendarEvent, CalendarViewSettings, User, MSCalendarEvent } from "@shared/schema";

interface CalendarColorPreference {
  id: string;
  userId: string;
  calendarOwnerId: string;
  color: string;
}

interface CalendarViewProps {
  serviceFilter?: string;
  taskAssigneeFilter?: string;
  serviceOwnerFilter?: string;
  userFilter?: string;
  showArchived?: boolean;
  onEventClick: (event: CalendarEvent) => void;
  initialSettings?: CalendarViewSettings;
  onSettingsChange?: (settings: CalendarViewSettings) => void;
  currentUserId?: string;
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
  currentUserId,
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
  const [showMSCalendar, setShowMSCalendar] = useState(
    initialSettings?.showMSCalendar ?? true
  );
  const [selectedCalendarUserIds, setSelectedCalendarUserIds] = useState<string[]>([]);
  const [createMeetingOpen, setCreateMeetingOpen] = useState(false);
  const [selectedMSEvent, setSelectedMSEvent] = useState<MSCalendarEvent | null>(null);
  const [msEventDetailOpen, setMsEventDetailOpen] = useState(false);

  const { data: msCalendarStatus } = useQuery<{ configured: boolean }>({
    queryKey: ['/api/ms-calendar/status'],
    staleTime: 60000,
  });

  const msCalendarConfigured = msCalendarStatus?.configured ?? false;

  const { data: myCalendarAccess } = useQuery<Array<{ canAccessUser: User }>>({
    queryKey: ['/api/users/my-calendar-access'],
    enabled: msCalendarConfigured,
    staleTime: 60000,
  });

  const { data: colorPreferencesData } = useQuery<CalendarColorPreference[]>({
    queryKey: ['/api/calendar/color-preferences'],
    enabled: msCalendarConfigured,
    staleTime: 30000,
  });

  const calendarColors = useMemo(() => {
    const colors: Record<string, string> = {};
    if (colorPreferencesData) {
      for (const pref of colorPreferencesData) {
        colors[pref.calendarOwnerId] = pref.color;
      }
    }
    return colors;
  }, [colorPreferencesData]);

  const updateColorMutation = useMutation({
    mutationFn: async ({ calendarOwnerId, color }: { calendarOwnerId: string; color: string }) => {
      await apiRequest('POST', '/api/calendar/color-preferences', { calendarOwnerId, color });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/color-preferences'] });
    },
  });

  const handleCalendarColorChange = (calendarOwnerId: string, color: string) => {
    updateColorMutation.mutate({ calendarOwnerId, color });
  };

  const accessibleCalendars: CalendarAccessUser[] = useMemo(() => {
    const calendars: CalendarAccessUser[] = [];
    if (currentUserId) {
      calendars.push({
        id: currentUserId,
        firstName: 'My',
        lastName: 'Calendar',
        email: null,
      });
    }
    if (myCalendarAccess) {
      for (const access of myCalendarAccess) {
        calendars.push({
          id: access.canAccessUser.id,
          firstName: access.canAccessUser.firstName,
          lastName: access.canAccessUser.lastName,
          email: access.canAccessUser.email,
        });
      }
    }
    return calendars;
  }, [myCalendarAccess, currentUserId]);

  useEffect(() => {
    if (currentUserId && selectedCalendarUserIds.length === 0 && accessibleCalendars.length > 0) {
      setSelectedCalendarUserIds([currentUserId]);
    }
  }, [currentUserId, accessibleCalendars]);

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

  const { data: msCalendarData, isLoading: msCalendarLoading } = useOutlookCalendarEvents({
    start: dateRange.start,
    end: dateRange.end,
    selectedUserIds: selectedCalendarUserIds,
    enabled: msCalendarConfigured && showMSCalendar && selectedCalendarUserIds.length > 0,
  });

  const msCalendarEventsAsCalendarEvents: CalendarEvent[] = useMemo(() => {
    if (!msCalendarData?.events || !showMSCalendar) return [];
    
    return msCalendarData.events.map((msEvent: MSCalendarEvent): CalendarEvent => ({
      id: `ms_${msEvent.id}`,
      type: "project_due",
      title: msEvent.subject,
      date: msEvent.start.dateTime,
      entityId: msEvent.id,
      entityType: "project",
      assigneeId: msEvent.calendarOwnerId,
      assigneeName: msEvent.calendarOwnerName,
      clientId: null,
      clientName: null,
      status: msEvent.showAs || "busy",
      color: msEvent.color,
      isOverdue: false,
      meta: {
        description: msEvent.body?.content,
        msCalendarEvent: msEvent,
      } as any,
    }));
  }, [msCalendarData, showMSCalendar]);

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
        showMSCalendar,
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
        showMSCalendar: key === "showMSCalendar" ? value : showMSCalendar,
      };
      onSettingsChange(settings);
    }
  };

  const events = useMemo(() => {
    const projectEvents = data?.events || [];
    return [...projectEvents, ...msCalendarEventsAsCalendarEvents];
  }, [data?.events, msCalendarEventsAsCalendarEvents]);

  const combinedLoading = isLoading || msCalendarLoading;

  const handleEventClick = (event: CalendarEvent) => {
    if (event.id.startsWith('ms_') && event.meta?.msCalendarEvent) {
      setSelectedMSEvent(event.meta.msCalendarEvent as MSCalendarEvent);
      setMsEventDetailOpen(true);
    } else {
      onEventClick(event);
    }
  };

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
        showMSCalendar={showMSCalendar}
        setShowMSCalendar={(v) => handleSettingChange(setShowMSCalendar, "showMSCalendar", v)}
        msCalendarConfigured={msCalendarConfigured}
        accessibleCalendars={accessibleCalendars}
        selectedCalendarUserIds={selectedCalendarUserIds}
        onSelectedCalendarUserIdsChange={setSelectedCalendarUserIds}
        currentUserId={currentUserId}
        onCreateMeeting={() => setCreateMeetingOpen(true)}
        calendarColors={calendarColors}
        onCalendarColorChange={handleCalendarColorChange}
      />

      <div className="flex-1 mt-4 relative">
        {combinedLoading && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {viewType === "month" ? (
          <CalendarMonthView
            currentDate={currentDate}
            events={events}
            onEventClick={handleEventClick}
          />
        ) : (
          <CalendarWeekView
            currentDate={currentDate}
            events={events}
            onEventClick={handleEventClick}
          />
        )}
      </div>

      {events.length === 0 && !combinedLoading && (
        <div className="text-center text-muted-foreground py-8">
          No events found for this period. Try adjusting the filters or date range.
        </div>
      )}

      <CreateMeetingModal
        open={createMeetingOpen}
        onOpenChange={setCreateMeetingOpen}
      />

      <MSCalendarEventDetailModal
        event={selectedMSEvent}
        open={msEventDetailOpen}
        onOpenChange={setMsEventDetailOpen}
        currentUserId={currentUserId}
      />
    </div>
  );
}
