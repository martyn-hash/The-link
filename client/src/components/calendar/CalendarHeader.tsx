import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";

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
}: CalendarHeaderProps) {
  const displayFormat = viewType === "month" 
    ? "MMMM yyyy" 
    : "'Week of' MMM d, yyyy";

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
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
