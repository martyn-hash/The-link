import { relations } from "drizzle-orm";
import {
  services,
  clientServices,
  peopleServices,
  workRoles,
  serviceRoles,
  clientServiceRoleAssignments,
  chChangeRequests,
} from "./tables";

import { users } from "../users/tables";
import { clients, people } from "../clients/tables";
import { projectTypes, projectSchedulingHistory } from "../../schema";

export const servicesRelations = relations(services, ({ one, many }) => ({
  projectType: one(projectTypes, {
    fields: [services.projectTypeId],
    references: [projectTypes.id],
  }),
  clientServices: many(clientServices),
  peopleServices: many(peopleServices),
  serviceRoles: many(serviceRoles),
}));

export const clientServicesRelations = relations(clientServices, ({ one, many }) => ({
  client: one(clients, {
    fields: [clientServices.clientId],
    references: [clients.id],
  }),
  service: one(services, {
    fields: [clientServices.serviceId],
    references: [services.id],
  }),
  serviceOwner: one(users, {
    fields: [clientServices.serviceOwnerId],
    references: [users.id],
    relationName: "serviceOwner",
  }),
  inactiveByUser: one(users, {
    fields: [clientServices.inactiveByUserId],
    references: [users.id],
    relationName: "inactiveByUser",
  }),
  roleAssignments: many(clientServiceRoleAssignments),
  schedulingHistory: many(projectSchedulingHistory, { relationName: "clientServiceSchedulingHistory" }),
}));

export const peopleServicesRelations = relations(peopleServices, ({ one, many }) => ({
  person: one(people, {
    fields: [peopleServices.personId],
    references: [people.id],
  }),
  service: one(services, {
    fields: [peopleServices.serviceId],
    references: [services.id],
  }),
  serviceOwner: one(users, {
    fields: [peopleServices.serviceOwnerId],
    references: [users.id],
  }),
  schedulingHistory: many(projectSchedulingHistory, { relationName: "peopleServiceSchedulingHistory" }),
}));

export const workRolesRelations = relations(workRoles, ({ many }) => ({
  serviceRoles: many(serviceRoles),
  roleAssignments: many(clientServiceRoleAssignments),
}));

export const serviceRolesRelations = relations(serviceRoles, ({ one }) => ({
  service: one(services, {
    fields: [serviceRoles.serviceId],
    references: [services.id],
  }),
  workRole: one(workRoles, {
    fields: [serviceRoles.roleId],
    references: [workRoles.id],
  }),
}));

export const clientServiceRoleAssignmentsRelations = relations(clientServiceRoleAssignments, ({ one }) => ({
  clientService: one(clientServices, {
    fields: [clientServiceRoleAssignments.clientServiceId],
    references: [clientServices.id],
  }),
  workRole: one(workRoles, {
    fields: [clientServiceRoleAssignments.workRoleId],
    references: [workRoles.id],
  }),
  user: one(users, {
    fields: [clientServiceRoleAssignments.userId],
    references: [users.id],
  }),
}));

export const chChangeRequestsRelations = relations(chChangeRequests, ({ one }) => ({
  client: one(clients, {
    fields: [chChangeRequests.clientId],
    references: [clients.id],
  }),
  approver: one(users, {
    fields: [chChangeRequests.approvedBy],
    references: [users.id],
  }),
}));
