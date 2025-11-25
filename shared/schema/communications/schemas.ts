import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
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

export const insertCommunicationSchema = createInsertSchema(communications).omit({
  id: true,
  loggedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  actualContactTime: z.coerce.date(),
});

export const insertMessageThreadSchema = createInsertSchema(messageThreads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectMessageThreadSchema = createInsertSchema(projectMessageThreads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectMessageSchema = createInsertSchema(projectMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectMessageParticipantSchema = createInsertSchema(projectMessageParticipants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStaffMessageThreadSchema = createInsertSchema(staffMessageThreads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStaffMessageSchema = createInsertSchema(staffMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStaffMessageParticipantSchema = createInsertSchema(staffMessageParticipants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserIntegrationSchema = createInsertSchema(userIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserActivityTrackingSchema = createInsertSchema(userActivityTracking).omit({
  id: true,
  viewedAt: true,
});
