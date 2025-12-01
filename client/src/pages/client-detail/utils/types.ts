import { z } from "zod";
import type { 
  Client, 
  Person, 
  ClientPerson, 
  Service, 
  ClientService, 
  User, 
  WorkRole, 
  ClientServiceRoleAssignment,
  PeopleService,
  Communication 
} from "@shared/schema";
import { insertPersonSchema } from "@shared/schema";
export { insertPersonSchema };

export type CommunicationWithRelations = Communication & {
  client: Client;
  person?: Person;
  user: User;
};

export type ClientPersonWithPerson = ClientPerson & { person: Person };

export type ClientPersonWithClient = ClientPerson & { client: Client };

export type ClientServiceWithService = ClientService & { 
  service: Service & { 
    projectType: { 
      id: string; 
      name: string; 
      description: string | null; 
      serviceId: string | null; 
      active: boolean | null; 
      order: number; 
      createdAt: Date | null;
    }; 
  }; 
};

export type ServiceWithDetails = Service & {
  roles: WorkRole[];
};

export type EnhancedClientService = ClientService & {
  service: Service & {
    projectType?: {
      id: string;
      name: string;
      description: string | null;
      serviceId: string | null;
      active: boolean | null;
      order: number;
      createdAt: Date | null;
    };
  };
  serviceOwner?: User;
  roleAssignments: (ClientServiceRoleAssignment & {
    workRole: WorkRole;
    user: User;
  })[];
};

export type PeopleServiceWithRelations = PeopleService & { 
  person: Person; 
  service: Service; 
  serviceOwner?: User;
};

export const addServiceSchema = z.object({
  serviceId: z.string().min(1, "Service is required"),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "annually"]).optional(),
  nextStartDate: z.string().optional(),
  nextDueDate: z.string().optional(),
  targetDeliveryDate: z.string().optional(),
  serviceOwnerId: z.string().optional(),
});

export type AddServiceData = z.infer<typeof addServiceSchema>;

export const addPersonSchema = insertPersonSchema.extend({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  email2: z.string().email("Invalid email format").optional().or(z.literal("")),
  telephone2: z.string().optional().or(z.literal("")),
  linkedinUrl: z.union([z.string().url("Invalid LinkedIn URL"), z.literal("")]).optional(),
  instagramUrl: z.union([z.string().url("Invalid Instagram URL"), z.literal("")]).optional(),
  twitterUrl: z.union([z.string().url("Invalid Twitter/X URL"), z.literal("")]).optional(),
  facebookUrl: z.union([z.string().url("Invalid Facebook URL"), z.literal("")]).optional(),
  tiktokUrl: z.union([z.string().url("Invalid TikTok URL"), z.literal("")]).optional(),
});

export type InsertPersonData = z.infer<typeof addPersonSchema>;

export const updatePersonSchema = insertPersonSchema.partial().extend({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  email2: z.string().email("Invalid email format").optional().or(z.literal("")),
  telephone2: z.string().optional().or(z.literal("")),
  primaryPhone: z.string().optional().or(z.literal("")),
  primaryEmail: z.string().email("Invalid email format").optional().or(z.literal("")),
  linkedinUrl: z.union([z.string().url("Invalid LinkedIn URL"), z.literal("")]).optional(),
  instagramUrl: z.union([z.string().url("Invalid Instagram URL"), z.literal("")]).optional(),
  twitterUrl: z.union([z.string().url("Invalid Twitter/X URL"), z.literal("")]).optional(),
  facebookUrl: z.union([z.string().url("Invalid Facebook URL"), z.literal("")]).optional(),
  tiktokUrl: z.union([z.string().url("Invalid TikTok URL"), z.literal("")]).optional(),
});

export type UpdatePersonData = z.infer<typeof updatePersonSchema>;

export const editServiceSchema = z.object({
  nextStartDate: z.string().optional(),
  nextDueDate: z.string().optional(),
  targetDeliveryDate: z.string().optional(),
  serviceOwnerId: z.string().optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "annually"]).optional(),
  isActive: z.boolean().optional(),
  roleAssignments: z.array(z.object({
    workRoleId: z.string(),
    userId: z.string(),
  })).optional(),
});

export type EditServiceData = z.infer<typeof editServiceSchema>;

export const linkPersonToCompanySchema = z.object({
  clientId: z.string().min(1, "Company is required"),
  officerRole: z.string().optional(),
  isPrimaryContact: z.boolean().optional()
});

export type LinkPersonToCompanyData = z.infer<typeof linkPersonToCompanySchema>;

export interface AddServiceModalProps {
  clientId: string;
  clientType?: 'company' | 'individual';
  onSuccess: () => void;
}
