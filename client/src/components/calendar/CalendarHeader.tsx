import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface CalendarAccessUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

export interface CalendarColorPreference {
  calendarOwnerId: string;
  color: string;
}

const CALENDAR_COLORS = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Purple", value: "#a855f7" },
  { name: "Orange", value: "#f97316" },
  { name: "Pink", value: "#ec4899" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Red", value: "#ef4444" },
  { name: "Yellow", value: "#eab308" },
];

interface CalendarHeaderProps {
  currentDate: Date;
  viewType: "month" | "week";
  onViewTypeChange: (type: "month" | "week") => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  showProjectDues: boolean;
  setShowProjectDues: (value: boolean) => void;
  showTargetDates: boolean;
  setShowTargetDates: (value: boolean) => void;
  showStageDeadlines: boolean;
  setShowStageDeadlines: (value: boolean) => void;
  showTasks: boolean;
  setShowTasks: (value: boolean) => void;
  showMSCalendar?: boolean;
  setShowMSCalendar?: (value: boolean) => void;
  msCalendarConfigured?: boolean;
  accessibleCalendars?: CalendarAccessUser[];
  selectedCalendarUserIds?: string[];
  onSelectedCalendarUserIdsChange?: (ids: string[]) => void;
  currentUserId?: string;
  onCreateMeeting?: () => void;
  calendarColors?: Record<string, string>;
  onCalendarColorChange?: (calendarOwnerId: string, color: string) => void;
}

export default function CalendarHeader({
  currentDate,
  viewType,
  onViewTypeChange,
  onPrevious,
  onNext,
  onToday,
  showProjectDues,
  setShowProjectDues,
  showTargetDates,
  setShowTargetDates,
  showStageDeadlines,
  setShowStageDeadlines,
  showTasks,
  setShowTasks,
  showMSCalendar,
  setShowMSCalendar,
  msCalendarConfigured,
  accessibleCalendars = [],
  selectedCalendarUserIds = [],
  onSelectedCalendarUserIdsChange,
  currentUserId,
  onCreateMeeting,
  calendarColors = {},
  onCalendarColorChange,
}: CalendarHeaderProps) {
  const displayFormat = viewType === "month" 
    ? "MMMM yyyy" 
    : "'Week of' MMM d, yyyy";

  const getUserDisplayName = (user: CalendarAccessUser) => {
    const parts = [user.firstName, user.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : user.email || 'Unknown';
  };

  const toggleCalendarUser = (userId: string) => {
    if (!onSelectedCalendarUserIdsChange) return;
    if (selectedCalendarUserIds.includes(userId)) {
      onSelectedCalendarUserIdsChange(selectedCalendarUserIds.filter(id => id !== userId));
    } else {
      onSelectedCalendarUserIdsChange([...selectedCalendarUserIds, userId]);
    }
  };

  const hasAccessibleCalendars = accessibleCalendars.length > 0;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={onPrevious}
          data-testid="button-calendar-prev"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          onClick={onNext}
          data-testid="button-calendar-next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onToday}
          data-testid="button-calendar-today"
        >
          Today
        </Button>

        <h2 className="text-lg font-semibold ml-2" data-testid="text-calendar-title">
          {format(currentDate, displayFormat)}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        {msCalendarConfigured && onCreateMeeting && (
          <Button
            size="sm"
            onClick={onCreateMeeting}
            data-testid="button-create-meeting"
          >
            <Plus className="h-4 w-4 mr-1" />
            New Meeting
          </Button>
        )}

        <div className="flex items-center border rounded-lg overflow-hidden">
          <Button
            variant={viewType === "month" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewTypeChange("month")}
            className="rounded-none"
            data-testid="button-view-month"
          >
            Month
          </Button>
          <Button
            variant={viewType === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewTypeChange("week")}
            className="rounded-none"
            data-testid="button-view-week"
          >
            Week
          </Button>
        </div>

        {msCalendarConfigured && hasAccessibleCalendars && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-calendar-users">
                <Users className="h-4 w-4 mr-1" />
                Calendars
                {selectedCalendarUserIds.length > 0 && (
                  <span className="ml-1 bg-primary text-primary-foreground rounded-full px-1.5 text-xs">
                    {selectedCalendarUserIds.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-2">
                <h4 className="font-medium text-sm mb-3">Show Calendars</h4>
                {accessibleCalendars.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-1"
                  >
                    <button
                      onClick={() => toggleCalendarUser(user.id)}
                      className={cn(
                        "flex items-center flex-1 px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors",
                        selectedCalendarUserIds.includes(user.id) && "bg-muted"
                      )}
                      data-testid={`button-toggle-calendar-${user.id}`}
                    >
                      <div className={cn(
                        "w-4 h-4 border rounded mr-2 flex items-center justify-center",
                        selectedCalendarUserIds.includes(user.id) 
                          ? "bg-primary border-primary" 
                          : "border-input"
                      )}>
                        {selectedCalendarUserIds.includes(user.id) && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                      </div>
                      <span className="flex-1 text-left">{getUserDisplayName(user)}</span>
                      {user.id === currentUserId && (
                        <span className="ml-1 text-muted-foreground text-xs">(You)</span>
                      )}
                    </button>
                    {onCalendarColorChange && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className="p-1.5 rounded-md hover:bg-muted transition-colors"
                            data-testid={`button-calendar-color-${user.id}`}
                          >
                            <div 
                              className="w-4 h-4 rounded-full border border-border"
                              style={{ backgroundColor: calendarColors[user.id] || CALENDAR_COLORS[0].value }}
                            />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2" align="end" side="right">
                          <div className="grid grid-cols-4 gap-1.5">
                            {CALENDAR_COLORS.map((color) => (
                              <Tooltip key={color.value}>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => onCalendarColorChange(user.id, color.value)}
                                    className={cn(
                                      "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110",
                                      calendarColors[user.id] === color.value 
                                        ? "border-foreground" 
                                        : "border-transparent"
                                    )}
                                    style={{ backgroundColor: color.value }}
                                    data-testid={`button-color-${user.id}-${color.name.toLowerCase()}`}
                                  />
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p>{color.name}</p>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                ))}
                {accessibleCalendars.length === 0 && (
                  <p className="text-sm text-muted-foreground">No accessible calendars</p>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-calendar-options">
              <CalendarIcon className="h-4 w-4 mr-1" />
              Options
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="end">
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Show on Calendar</h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-project-dues" className="text-sm">
                    Project Due Dates
                  </Label>
                  <Switch
                    id="show-project-dues"
                    checked={showProjectDues}
                    onCheckedChange={setShowProjectDues}
                    data-testid="switch-show-project-dues"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="show-target-dates" className="text-sm">
                    Target Delivery Dates
                  </Label>
                  <Switch
                    id="show-target-dates"
                    checked={showTargetDates}
                    onCheckedChange={setShowTargetDates}
                    data-testid="switch-show-target-dates"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="show-stage-deadlines" className="text-sm">
                    Stage Deadlines
                  </Label>
                  <Switch
                    id="show-stage-deadlines"
                    checked={showStageDeadlines}
                    onCheckedChange={setShowStageDeadlines}
                    data-testid="switch-show-stage-deadlines"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="show-tasks" className="text-sm">
                    Tasks
                  </Label>
                  <Switch
                    id="show-tasks"
                    checked={showTasks}
                    onCheckedChange={setShowTasks}
                    data-testid="switch-show-tasks"
                  />
                </div>

                {msCalendarConfigured && setShowMSCalendar && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <Label htmlFor="show-ms-calendar" className="text-sm">
                      Outlook Calendar
                    </Label>
                    <Switch
                      id="show-ms-calendar"
                      checked={showMSCalendar ?? false}
                      onCheckedChange={setShowMSCalendar}
                      data-testid="switch-show-ms-calendar"
                    />
                  </div>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
