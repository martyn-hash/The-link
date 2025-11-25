import { z } from "zod";
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
import {
  insertTaskInstanceSchema,
  updateTaskInstanceSchema,
  insertTaskInstanceResponseSchema,
  insertTaskTypeSchema,
  updateTaskTypeSchema,
  insertInternalTaskSchema,
  updateInternalTaskSchema,
  closeInternalTaskSchema,
  insertTaskConnectionSchema,
  insertTaskProgressNoteSchema,
  insertTaskTimeEntrySchema,
  stopTaskTimeEntrySchema,
  insertTaskDocumentSchema,
  bulkReassignTasksSchema,
  bulkUpdateTaskStatusSchema,
} from "./schemas";

export type TaskInstance = typeof taskInstances.$inferSelect;
export type InsertTaskInstance = z.infer<typeof insertTaskInstanceSchema>;
export type UpdateTaskInstance = z.infer<typeof updateTaskInstanceSchema>;

export type TaskInstanceResponse = typeof taskInstanceResponses.$inferSelect;
export type InsertTaskInstanceResponse = z.infer<typeof insertTaskInstanceResponseSchema>;

export type TaskType = typeof taskTypes.$inferSelect;
export type InsertTaskType = z.infer<typeof insertTaskTypeSchema>;
export type UpdateTaskType = z.infer<typeof updateTaskTypeSchema>;

export type InternalTask = typeof internalTasks.$inferSelect;
export type InsertInternalTask = z.infer<typeof insertInternalTaskSchema>;
export type UpdateInternalTask = z.infer<typeof updateInternalTaskSchema>;
export type CloseInternalTask = z.infer<typeof closeInternalTaskSchema>;

export type TaskConnection = typeof taskConnections.$inferSelect;
export type InsertTaskConnection = z.infer<typeof insertTaskConnectionSchema>;

export type TaskProgressNote = typeof taskProgressNotes.$inferSelect;
export type InsertTaskProgressNote = z.infer<typeof insertTaskProgressNoteSchema>;

export type TaskTimeEntry = typeof taskTimeEntries.$inferSelect;
export type InsertTaskTimeEntry = z.infer<typeof insertTaskTimeEntrySchema>;
export type StopTaskTimeEntry = z.infer<typeof stopTaskTimeEntrySchema>;

export type TaskDocument = typeof taskDocuments.$inferSelect;
export type InsertTaskDocument = z.infer<typeof insertTaskDocumentSchema>;

export type BulkReassignTasks = z.infer<typeof bulkReassignTasksSchema>;
export type BulkUpdateTaskStatus = z.infer<typeof bulkUpdateTaskStatusSchema>;
