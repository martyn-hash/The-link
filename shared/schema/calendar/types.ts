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
  showMSCalendar: z.boolean().optional(),
});

export type CalendarViewSettings = z.infer<typeof calendarViewSettingsSchema>;

export type ViewMode = "kanban" | "list" | "dashboard" | "calendar";

export const msCalendarEventSchema = z.object({
  id: z.string(),
  type: z.literal("ms_calendar"),
  subject: z.string(),
  body: z.object({
    contentType: z.enum(["text", "html"]),
    content: z.string(),
  }).optional(),
  start: z.object({
    dateTime: z.string(),
    timeZone: z.string(),
  }),
  end: z.object({
    dateTime: z.string(),
    timeZone: z.string(),
  }),
  location: z.object({
    displayName: z.string(),
  }).optional(),
  attendees: z.array(z.object({
    emailAddress: z.object({
      address: z.string(),
      name: z.string().optional(),
    }),
    type: z.enum(["required", "optional", "resource"]),
    status: z.object({
      response: z.enum(["none", "organizer", "tentativelyAccepted", "accepted", "declined", "notResponded"]).optional(),
    }).optional(),
  })).optional(),
  isOnlineMeeting: z.boolean().optional(),
  onlineMeeting: z.object({
    joinUrl: z.string(),
  }).nullable().optional(),
  isAllDay: z.boolean().optional(),
  showAs: z.enum(["free", "tentative", "busy", "oof", "workingElsewhere", "unknown"]).optional(),
  importance: z.enum(["low", "normal", "high"]).optional(),
  sensitivity: z.enum(["normal", "personal", "private", "confidential"]).optional(),
  organizer: z.object({
    emailAddress: z.object({
      address: z.string(),
      name: z.string().optional(),
    }),
  }).optional(),
  webLink: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  calendarOwnerEmail: z.string(),
  calendarOwnerName: z.string(),
  calendarOwnerId: z.string(),
  color: z.string(),
});

export type MSCalendarEvent = z.infer<typeof msCalendarEventSchema>;

export const createMeetingSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  description: z.string().optional(),
  startDateTime: z.string(),
  endDateTime: z.string(),
  timeZone: z.string().default("Europe/London"),
  location: z.string().optional(),
  attendeeEmails: z.array(z.string().email()).optional(),
  isTeamsMeeting: z.boolean().default(false),
  isAllDay: z.boolean().default(false),
  reminderMinutes: z.number().optional(),
});

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;

export const updateMeetingSchema = z.object({
  subject: z.string().min(1, "Subject is required").optional(),
  description: z.string().optional(),
  startDateTime: z.string().optional(),
  endDateTime: z.string().optional(),
  timeZone: z.string().optional(),
  location: z.string().optional(),
  attendeeEmails: z.array(z.string().email()).optional(),
  isTeamsMeeting: z.boolean().optional(),
  isAllDay: z.boolean().optional(),
  showAs: z.enum(["free", "tentative", "busy", "oof", "workingElsewhere"]).optional(),
  reminderMinutes: z.number().optional(),
});

export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;
