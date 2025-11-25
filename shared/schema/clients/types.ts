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
import {
  insertClientSchema,
  insertPersonSchema,
  insertClientPersonSchema,
  insertClientChronologySchema,
  insertClientTagSchema,
  insertPeopleTagSchema,
  insertClientTagAssignmentSchema,
  insertPeopleTagAssignmentSchema,
  insertClientPortalUserSchema,
  insertClientEmailAliasSchema,
  insertClientDomainAllowlistSchema,
  insertCompanySettingsSchema,
  updateCompanySettingsSchema,
} from './schemas';

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type Person = typeof people.$inferSelect;
export type InsertPerson = z.infer<typeof insertPersonSchema>;

export type ClientPerson = typeof clientPeople.$inferSelect;
export type InsertClientPerson = z.infer<typeof insertClientPersonSchema>;

export type InsertClientChronology = z.infer<typeof insertClientChronologySchema>;
export type SelectClientChronology = typeof clientChronology.$inferSelect;

export type ClientTag = typeof clientTags.$inferSelect;
export type InsertClientTag = z.infer<typeof insertClientTagSchema>;

export type PeopleTag = typeof peopleTags.$inferSelect;
export type InsertPeopleTag = z.infer<typeof insertPeopleTagSchema>;

export type ClientTagAssignment = typeof clientTagAssignments.$inferSelect;
export type InsertClientTagAssignment = z.infer<typeof insertClientTagAssignmentSchema>;

export type PeopleTagAssignment = typeof peopleTagAssignments.$inferSelect;
export type InsertPeopleTagAssignment = z.infer<typeof insertPeopleTagAssignmentSchema>;

export type ClientPortalUser = typeof clientPortalUsers.$inferSelect;
export type InsertClientPortalUser = z.infer<typeof insertClientPortalUserSchema>;

export type ClientEmailAlias = typeof clientEmailAliases.$inferSelect;
export type InsertClientEmailAlias = z.infer<typeof insertClientEmailAliasSchema>;

export type ClientDomainAllowlist = typeof clientDomainAllowlist.$inferSelect;
export type InsertClientDomainAllowlist = z.infer<typeof insertClientDomainAllowlistSchema>;

export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
export type UpdateCompanySettings = z.infer<typeof updateCompanySettingsSchema>;
