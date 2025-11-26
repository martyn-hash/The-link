/**
 * Client domain relations for Drizzle ORM
 * 
 * These relations enable the relational query builder:
 * db.query.clients.findFirst({ with: { clientPeople: true } })
 * 
 * Imports are directly from domain modules to avoid circular dependencies.
 */
import { relations } from 'drizzle-orm';
import { clients, people, clientPeople, clientChronology, clientPortalUsers, clientTags, clientTagAssignments, clientEmailAliases, clientDomainAllowlist, peopleTags, peopleTagAssignments } from './tables';
import { users } from '../users/tables';
import { clientServices, clientServiceRoleAssignments } from '../services/tables';
import { projects } from '../projects/tables';
import { messageThreads } from '../communications/tables';

export const clientsRelations = relations(clients, ({ many }) => ({
  clientPeople: many(clientPeople),
  clientServices: many(clientServices),
  projects: many(projects),
  messageThreads: many(messageThreads),
  clientChronology: many(clientChronology),
  clientPortalUsers: many(clientPortalUsers),
  clientTagAssignments: many(clientTagAssignments),
  clientEmailAliases: many(clientEmailAliases),
  clientDomainAllowlist: many(clientDomainAllowlist),
}));

export const peopleRelations = relations(people, ({ many }) => ({
  clientPeople: many(clientPeople),
  peopleTagAssignments: many(peopleTagAssignments),
}));

export const clientPeopleRelations = relations(clientPeople, ({ one }) => ({
  client: one(clients, {
    fields: [clientPeople.clientId],
    references: [clients.id],
  }),
  person: one(people, {
    fields: [clientPeople.personId],
    references: [people.id],
  }),
}));

export const clientChronologyRelations = relations(clientChronology, ({ one }) => ({
  client: one(clients, {
    fields: [clientChronology.clientId],
    references: [clients.id],
  }),
  user: one(users, {
    fields: [clientChronology.userId],
    references: [users.id],
  }),
}));

export const clientPortalUsersRelations = relations(clientPortalUsers, ({ one }) => ({
  client: one(clients, {
    fields: [clientPortalUsers.clientId],
    references: [clients.id],
  }),
  person: one(people, {
    fields: [clientPortalUsers.personId],
    references: [people.id],
  }),
}));

export const clientTagsRelations = relations(clientTags, ({ many }) => ({
  assignments: many(clientTagAssignments),
}));

export const clientTagAssignmentsRelations = relations(clientTagAssignments, ({ one }) => ({
  client: one(clients, {
    fields: [clientTagAssignments.clientId],
    references: [clients.id],
  }),
  tag: one(clientTags, {
    fields: [clientTagAssignments.tagId],
    references: [clientTags.id],
  }),
  assignedByUser: one(users, {
    fields: [clientTagAssignments.assignedBy],
    references: [users.id],
  }),
}));

export const peopleTagsRelations = relations(peopleTags, ({ many }) => ({
  assignments: many(peopleTagAssignments),
}));

export const peopleTagAssignmentsRelations = relations(peopleTagAssignments, ({ one }) => ({
  person: one(people, {
    fields: [peopleTagAssignments.personId],
    references: [people.id],
  }),
  tag: one(peopleTags, {
    fields: [peopleTagAssignments.tagId],
    references: [peopleTags.id],
  }),
  assignedByUser: one(users, {
    fields: [peopleTagAssignments.assignedBy],
    references: [users.id],
  }),
}));

export const clientEmailAliasesRelations = relations(clientEmailAliases, ({ one }) => ({
  client: one(clients, {
    fields: [clientEmailAliases.clientId],
    references: [clients.id],
  }),
}));

export const clientDomainAllowlistRelations = relations(clientDomainAllowlist, ({ one }) => ({
  client: one(clients, {
    fields: [clientDomainAllowlist.clientId],
    references: [clients.id],
  }),
  createdByUser: one(users, {
    fields: [clientDomainAllowlist.createdBy],
    references: [users.id],
  }),
}));
