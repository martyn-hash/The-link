import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import {
  taskInstances,
  taskInstanceResponses,
  taskTypes,
  internalTasks,
  taskConnections,
  taskProgressNotes,
  taskTimeEntries,
  taskDocuments,
} from "./tables";

const baseTaskInstanceSchema = createInsertSchema(taskInstances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
  approvedAt: true,
}).extend({
  dueDate: z.union([z.string(), z.date()]).optional().nullable().transform(val => {
    if (!val) return null;
    if (typeof val === 'string') return new Date(val);
    return val;
  }),
});

export const insertTaskInstanceSchema = baseTaskInstanceSchema.refine(
  (data) => (data.templateId !== null && data.customRequestId === null) || (data.templateId === null && data.customRequestId !== null),
  { message: "Either templateId or customRequestId must be provided, but not both" }
);

export const updateTaskInstanceSchema = baseTaskInstanceSchema.partial();

export const updateTaskInstanceStatusSchema = z.object({
  status: z.enum(["not_started", "in_progress", "submitted", "approved", "cancelled"]),
});

export const insertTaskInstanceResponseSchema = createInsertSchema(taskInstanceResponses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaskTypeSchema = createInsertSchema(taskTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateTaskTypeSchema = insertTaskTypeSchema.partial();

export const insertInternalTaskSchema = createInsertSchema(internalTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  closedAt: true,
  closedBy: true,
  totalTimeSpentMinutes: true,
}).extend({
  dueDate: z.union([z.string(), z.date()]).optional().nullable().transform(val => {
    if (!val) return null;
    if (typeof val === 'string') return new Date(val);
    return val;
  }),
});

export const updateInternalTaskSchema = insertInternalTaskSchema.partial();

export const closeInternalTaskSchema = z.object({
  closureNote: z.string().min(1, "Closure note is required"),
  totalTimeSpentMinutes: z.number().int().min(0, "Time spent must be a positive number"),
});

export const insertTaskConnectionSchema = createInsertSchema(taskConnections).omit({
  id: true,
  createdAt: true,
});

export const insertTaskProgressNoteSchema = createInsertSchema(taskProgressNotes).omit({
  id: true,
  createdAt: true,
});

export const insertTaskTimeEntrySchema = createInsertSchema(taskTimeEntries).omit({
  id: true,
  createdAt: true,
  durationMinutes: true,
}).extend({
  startTime: z.union([z.string(), z.date()]).transform(val => {
    if (typeof val === 'string') return new Date(val);
    return val;
  }),
  endTime: z.union([z.string(), z.date()]).optional().nullable().transform(val => {
    if (!val) return null;
    if (typeof val === 'string') return new Date(val);
    return val;
  }),
});

export const stopTaskTimeEntrySchema = z.object({
  note: z.string().optional(),
});

export const insertTaskDocumentSchema = createInsertSchema(taskDocuments).omit({
  id: true,
  createdAt: true,
});

export const bulkReassignTasksSchema = z.object({
  taskIds: z.array(z.string().uuid()),
  assignedTo: z.string().uuid(),
});

export const bulkUpdateTaskStatusSchema = z.object({
  taskIds: z.array(z.string().uuid()),
  status: z.enum(["open", "in_progress", "closed"]),
});
