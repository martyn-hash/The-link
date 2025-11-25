import { relations } from "drizzle-orm";
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

import { users } from "../users/tables";
import { clients, people, clientPortalUsers } from "../clients/tables";
import { projects, services } from "../../schema";

export const communicationsRelations = relations(communications, ({ one }) => ({
  client: one(clients, {
    fields: [communications.clientId],
    references: [clients.id],
  }),
  person: one(people, {
    fields: [communications.personId],
    references: [people.id],
  }),
  project: one(projects, {
    fields: [communications.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [communications.userId],
    references: [users.id],
  }),
}));

export const userIntegrationsRelations = relations(userIntegrations, ({ one }) => ({
  user: one(users, {
    fields: [userIntegrations.userId],
    references: [users.id],
  }),
}));

export const messageThreadsRelations = relations(messageThreads, ({ one, many }) => ({
  client: one(clients, {
    fields: [messageThreads.clientId],
    references: [clients.id],
  }),
  createdByUser: one(users, {
    fields: [messageThreads.createdByUserId],
    references: [users.id],
    relationName: "threadCreator",
  }),
  createdByClientPortalUser: one(clientPortalUsers, {
    fields: [messageThreads.createdByClientPortalUserId],
    references: [clientPortalUsers.id],
  }),
  project: one(projects, {
    fields: [messageThreads.projectId],
    references: [projects.id],
  }),
  service: one(services, {
    fields: [messageThreads.serviceId],
    references: [services.id],
  }),
  archivedByUser: one(users, {
    fields: [messageThreads.archivedBy],
    references: [users.id],
    relationName: "threadArchiver",
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  thread: one(messageThreads, {
    fields: [messages.threadId],
    references: [messageThreads.id],
  }),
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
  clientPortalUser: one(clientPortalUsers, {
    fields: [messages.clientPortalUserId],
    references: [clientPortalUsers.id],
  }),
}));

export const userActivityTrackingRelations = relations(userActivityTracking, ({ one }) => ({
  user: one(users, {
    fields: [userActivityTracking.userId],
    references: [users.id],
  }),
}));

export const projectMessageThreadsRelations = relations(projectMessageThreads, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectMessageThreads.projectId],
    references: [projects.id],
  }),
  createdByUser: one(users, {
    fields: [projectMessageThreads.createdByUserId],
    references: [users.id],
    relationName: "projectThreadCreator",
  }),
  lastMessageByUser: one(users, {
    fields: [projectMessageThreads.lastMessageByUserId],
    references: [users.id],
    relationName: "projectThreadLastMessager",
  }),
  archivedByUser: one(users, {
    fields: [projectMessageThreads.archivedBy],
    references: [users.id],
    relationName: "projectThreadArchiver",
  }),
  messages: many(projectMessages),
  participants: many(projectMessageParticipants),
}));

export const projectMessagesRelations = relations(projectMessages, ({ one }) => ({
  thread: one(projectMessageThreads, {
    fields: [projectMessages.threadId],
    references: [projectMessageThreads.id],
  }),
  user: one(users, {
    fields: [projectMessages.userId],
    references: [users.id],
  }),
}));

export const projectMessageParticipantsRelations = relations(projectMessageParticipants, ({ one }) => ({
  thread: one(projectMessageThreads, {
    fields: [projectMessageParticipants.threadId],
    references: [projectMessageThreads.id],
  }),
  user: one(users, {
    fields: [projectMessageParticipants.userId],
    references: [users.id],
  }),
  lastReadMessage: one(projectMessages, {
    fields: [projectMessageParticipants.lastReadMessageId],
    references: [projectMessages.id],
  }),
}));

export const staffMessageThreadsRelations = relations(staffMessageThreads, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [staffMessageThreads.createdByUserId],
    references: [users.id],
    relationName: "staffThreadCreator",
  }),
  lastMessageByUser: one(users, {
    fields: [staffMessageThreads.lastMessageByUserId],
    references: [users.id],
    relationName: "staffThreadLastMessager",
  }),
  archivedByUser: one(users, {
    fields: [staffMessageThreads.archivedBy],
    references: [users.id],
    relationName: "staffThreadArchiver",
  }),
  messages: many(staffMessages),
  participants: many(staffMessageParticipants),
}));

export const staffMessagesRelations = relations(staffMessages, ({ one }) => ({
  thread: one(staffMessageThreads, {
    fields: [staffMessages.threadId],
    references: [staffMessageThreads.id],
  }),
  user: one(users, {
    fields: [staffMessages.userId],
    references: [users.id],
  }),
}));

export const staffMessageParticipantsRelations = relations(staffMessageParticipants, ({ one }) => ({
  thread: one(staffMessageThreads, {
    fields: [staffMessageParticipants.threadId],
    references: [staffMessageThreads.id],
  }),
  user: one(users, {
    fields: [staffMessageParticipants.userId],
    references: [users.id],
  }),
  lastReadMessage: one(staffMessages, {
    fields: [staffMessageParticipants.lastReadMessageId],
    references: [staffMessages.id],
  }),
}));
