import { z } from "zod";
import {
  services,
  clientServices,
  peopleServices,
  workRoles,
  serviceRoles,
  clientServiceRoleAssignments,
  chChangeRequests,
} from "./tables";
import {
  udfDefinitionSchema,
  insertServiceSchema,
  updateServiceSchema,
  insertWorkRoleSchema,
  insertServiceRoleSchema,
  insertClientServiceSchema,
  insertPeopleServiceSchema,
  insertClientServiceRoleAssignmentSchema,
  insertChChangeRequestSchema,
  updateChChangeRequestSchema,
  serviceClientTypeValues,
  type ServiceClientType,
} from "./schemas";

export { serviceClientTypeValues };
export type { ServiceClientType };

export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type UpdateService = z.infer<typeof updateServiceSchema>;

export type WorkRole = typeof workRoles.$inferSelect;
export type InsertWorkRole = z.infer<typeof insertWorkRoleSchema>;

export type ServiceRole = typeof serviceRoles.$inferSelect;
export type InsertServiceRole = z.infer<typeof insertServiceRoleSchema>;

export type ClientService = typeof clientServices.$inferSelect;
export type InsertClientService = z.infer<typeof insertClientServiceSchema>;

export type PeopleService = typeof peopleServices.$inferSelect;
export type InsertPeopleService = z.infer<typeof insertPeopleServiceSchema>;

export type ClientServiceRoleAssignment = typeof clientServiceRoleAssignments.$inferSelect;
export type InsertClientServiceRoleAssignment = z.infer<typeof insertClientServiceRoleAssignmentSchema>;

export type ChChangeRequest = typeof chChangeRequests.$inferSelect;
export type InsertChChangeRequest = z.infer<typeof insertChChangeRequestSchema>;
export type UpdateChChangeRequest = z.infer<typeof updateChChangeRequestSchema>;

export type UDFDefinition = z.infer<typeof udfDefinitionSchema>;
