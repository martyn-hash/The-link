import { z } from "zod";

export const calendarEventTypeSchema = z.enum([
  "project_due",
  "project_target", 
  "stage_deadline",
  "task_due"
]);

export type CalendarEventType = z.infer<typeof calendarEventTypeSchema>;

export const calendarEventSchema = z.object({
  id: z.string(),
  type: calendarEventTypeSchema,
  title: z.string(),
  date: z.string(),
  entityId: z.string(),
  entityType: z.enum(["project", "task"]),
  assigneeId: z.string().nullable(),
  assigneeName: z.string().nullable(),
  clientId: z.string().nullable(),
  clientName: z.string().nullable(),
  status: z.string(),
  color: z.string(),
  isOverdue: z.boolean(),
  meta: z.object({
    stageName: z.string().optional(),
    projectTypeName: z.string().optional(),
    serviceName: z.string().optional(),
    serviceId: z.string().optional(),
    priority: z.string().optional(),
    description: z.string().optional(),
  }).optional(),
});

export type CalendarEvent = z.infer<typeof calendarEventSchema>;

export const calendarEventsResponseSchema = z.object({
  events: z.array(calendarEventSchema),
  userColors: z.record(z.string(), z.string()),
});

export type CalendarEventsResponse = z.infer<typeof calendarEventsResponseSchema>;

export const calendarFiltersSchema = z.object({
  start: z.string(),
  end: z.string(),
  serviceFilter: z.string().optional(),
  taskAssigneeFilter: z.string().optional(),
  serviceOwnerFilter: z.string().optional(),
  userFilter: z.string().optional(),
  showArchived: z.boolean().optional(),
  includeProjectDues: z.boolean().optional(),
  includeTargetDates: z.boolean().optional(),
  includeStageDeadlines: z.boolean().optional(),
  includeTasks: z.boolean().optional(),
});

export type CalendarFilters = z.infer<typeof calendarFiltersSchema>;

export const calendarViewSettingsSchema = z.object({
  calendarViewType: z.enum(["month", "week"]),
  showProjectDueDates: z.boolean(),
  showProjectTargetDates: z.boolean(),
  showStageDeadlines: z.boolean(),
  showTaskDueDates: z.boolean(),
});

export type CalendarViewSettings = z.infer<typeof calendarViewSettingsSchema>;

export type ViewMode = "kanban" | "list" | "dashboard" | "calendar";
