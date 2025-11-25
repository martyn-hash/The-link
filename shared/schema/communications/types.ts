import { z } from "zod";
import {
  communications,
  userIntegrations,
  messageThreads,
  messages,
  userActivityTracking,
  projectMessageThreads,
  projectMessages,
  projectMessageParticipants,
  staffMessageThreads,
  staffMessages,
  staffMessageParticipants,
} from "./tables";
import {
  insertCommunicationSchema,
  insertUserIntegrationSchema,
  insertMessageThreadSchema,
  insertMessageSchema,
  insertUserActivityTrackingSchema,
  insertProjectMessageThreadSchema,
  insertProjectMessageSchema,
  insertProjectMessageParticipantSchema,
  insertStaffMessageThreadSchema,
  insertStaffMessageSchema,
  insertStaffMessageParticipantSchema,
} from "./schemas";

export type Communication = typeof communications.$inferSelect;
export type InsertCommunication = z.infer<typeof insertCommunicationSchema>;

export type UserIntegration = typeof userIntegrations.$inferSelect;
export type InsertUserIntegration = z.infer<typeof insertUserIntegrationSchema>;

export type MessageThread = typeof messageThreads.$inferSelect;
export type InsertMessageThread = z.infer<typeof insertMessageThreadSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type UserActivityTracking = typeof userActivityTracking.$inferSelect;
export type InsertUserActivityTracking = z.infer<typeof insertUserActivityTrackingSchema>;

export type ProjectMessageThread = typeof projectMessageThreads.$inferSelect;
export type InsertProjectMessageThread = z.infer<typeof insertProjectMessageThreadSchema>;

export type ProjectMessage = typeof projectMessages.$inferSelect;
export type InsertProjectMessage = z.infer<typeof insertProjectMessageSchema>;

export type ProjectMessageParticipant = typeof projectMessageParticipants.$inferSelect;
export type InsertProjectMessageParticipant = z.infer<typeof insertProjectMessageParticipantSchema>;

export type StaffMessageThread = typeof staffMessageThreads.$inferSelect;
export type InsertStaffMessageThread = z.infer<typeof insertStaffMessageThreadSchema>;

export type StaffMessage = typeof staffMessages.$inferSelect;
export type InsertStaffMessage = z.infer<typeof insertStaffMessageSchema>;

export type StaffMessageParticipant = typeof staffMessageParticipants.$inferSelect;
export type InsertStaffMessageParticipant = z.infer<typeof insertStaffMessageParticipantSchema>;
