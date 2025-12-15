import type { ProjectWithRelations, User, ProjectView, UserProjectPreferences } from "@shared/schema";

export type ViewMode = "kanban" | "list" | "dashboard" | "calendar" | "pivot";

export interface PivotConfig {
  rows: string[];
  cols: string[];
  vals: string[];
  aggregatorName: string;
  rendererName: string;
  valueFilter?: Record<string, Record<string, boolean>>;
  rowOrder?: string;
  colOrder?: string;
}
export type WorkspaceMode = "projects" | "tasks" | "comms";
export type DynamicDateFilter = "all" | "overdue" | "today" | "next7days" | "next14days" | "next30days" | "custom";
export type ScheduleStatusFilter = "all" | "behind" | "overdue" | "both";

export interface Widget {
  id: string;
  type: "bar" | "pie" | "number" | "line";
  title: string;
  groupBy: "projectType" | "status" | "assignee" | "serviceOwner" | "daysOverdue";
  metric?: string;
}

export interface Dashboard {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  filters: any;
  widgets: Widget[];
  visibility: "private" | "shared";
  isHomescreenDashboard?: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarSettings {
  calendarViewType: "month" | "week";
  showProjectDueDates: boolean;
  showProjectTargetDates: boolean;
  showStageDeadlines: boolean;
  showTaskDueDates: boolean;
  showMSCalendar?: boolean;
  selectedCalendarUserIds?: string[];
}

export interface ListViewSettings {
  sortBy: string;
  sortOrder: "asc" | "desc";
  itemsPerPage: number;
}

export interface CustomDateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface ProjectFilters {
  serviceFilter: string;
  taskAssigneeFilter: string;
  serviceOwnerFilter: string;
  userFilter: string;
  showArchived: boolean;
  showCompletedRegardless: boolean;
  dynamicDateFilter: DynamicDateFilter;
  customDateRange: CustomDateRange;
  serviceDueDateFilter: string;
  scheduleStatusFilter: ScheduleStatusFilter;
  clientHasProjectTypeIds: string[];
}

export interface DashboardFilters extends ProjectFilters {
  clientFilter: string;
  projectTypeFilter: string;
}

export const DEFAULT_PROJECT_FILTERS: ProjectFilters = {
  serviceFilter: "all",
  taskAssigneeFilter: "all",
  serviceOwnerFilter: "all",
  userFilter: "all",
  showArchived: false,
  showCompletedRegardless: true,
  dynamicDateFilter: "all",
  customDateRange: { from: undefined, to: undefined },
  serviceDueDateFilter: "all",
  scheduleStatusFilter: "all",
  clientHasProjectTypeIds: [],
};

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilters = {
  ...DEFAULT_PROJECT_FILTERS,
  clientFilter: "all",
  projectTypeFilter: "all",
};

export const ITEMS_PER_PAGE = 15;

export interface ServiceOption {
  id: string;
  name: string;
}

export interface StageOption {
  id: string;
  name: string;
  projectTypeId: string;
  maxInstanceTime: number | null;
}

export type { ProjectWithRelations, User, ProjectView, UserProjectPreferences };
