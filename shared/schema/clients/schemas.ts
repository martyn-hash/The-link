import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import {
  clients,
  people,
  clientPeople,
  clientChronology,
  clientTags,
  peopleTags,
  clientTagAssignments,
  peopleTagAssignments,
  clientPortalUsers,
  clientEmailAliases,
  clientDomainAllowlist,
  companySettings,
} from './tables';

const niNumberRegex = /^[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]?$/i;
const utrNumberRegex = /^\d{10}$/;
const ukPhoneRegex = /^(\+44|0)[1-9]\d{8,9}$/;

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

export const insertPersonSchema = createInsertSchema(people).omit({
  id: true,
  createdAt: true,
}).extend({
  niNumber: z.string().regex(niNumberRegex, "Invalid National Insurance number format").optional().or(z.literal("")),
  personalUtrNumber: z.string().regex(utrNumberRegex, "UTR must be exactly 10 digits").optional().or(z.literal("")),
  primaryPhone: z.string().regex(ukPhoneRegex, "Invalid UK phone number").optional().or(z.literal("")),
});

export const insertClientPersonSchema = createInsertSchema(clientPeople).omit({
  id: true,
  createdAt: true,
});

export const insertClientChronologySchema = createInsertSchema(clientChronology).omit({
  id: true,
  timestamp: true,
});

export const insertClientTagSchema = createInsertSchema(clientTags).omit({
  id: true,
  createdAt: true,
});

export const insertPeopleTagSchema = createInsertSchema(peopleTags).omit({
  id: true,
  createdAt: true,
});

export const insertClientTagAssignmentSchema = createInsertSchema(clientTagAssignments).omit({
  id: true,
  assignedAt: true,
});

export const insertPeopleTagAssignmentSchema = createInsertSchema(peopleTagAssignments).omit({
  id: true,
  assignedAt: true,
});

export const insertClientPortalUserSchema = createInsertSchema(clientPortalUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientEmailAliasSchema = createInsertSchema(clientEmailAliases).omit({
  id: true,
  createdAt: true,
});

export const insertClientDomainAllowlistSchema = createInsertSchema(clientDomainAllowlist).omit({
  id: true,
  createdAt: true,
});

export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCompanySettingsSchema = insertCompanySettingsSchema.partial();
