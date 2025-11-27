import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { webhookConfigs, webhookLogs } from "./tables";

export const insertWebhookConfigSchema = createInsertSchema(webhookConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateWebhookConfigSchema = insertWebhookConfigSchema.partial();

export const insertWebhookLogSchema = createInsertSchema(webhookLogs).omit({
  id: true,
  sentAt: true,
});

export const sendWebhookRequestSchema = z.object({
  webhookConfigIds: z.array(z.string()).min(1, "Select at least one webhook"),
});

export const webhookPayloadSchema = z.object({
  client: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().nullable().optional(),
    companyNumber: z.string().nullable().optional(),
    companyUtr: z.string().nullable().optional(),
    companiesHouseAuthCode: z.string().nullable().optional(),
    companyTelephone: z.string().nullable().optional(),
    registeredAddress1: z.string().nullable().optional(),
    registeredAddress2: z.string().nullable().optional(),
    registeredAddress3: z.string().nullable().optional(),
    registeredPostcode: z.string().nullable().optional(),
    registeredCountry: z.string().nullable().optional(),
    postalAddress1: z.string().nullable().optional(),
    postalAddress2: z.string().nullable().optional(),
    postalAddress3: z.string().nullable().optional(),
    postalAddressPostcode: z.string().nullable().optional(),
    postalAddressCountry: z.string().nullable().optional(),
    companyEmailDomain: z.string().nullable().optional(),
    tradingAs: z.string().nullable().optional(),
  }).passthrough(),
  people: z.array(z.object({
    id: z.string(),
    fullName: z.string(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    telephone: z.string().nullable().optional(),
    addressLine1: z.string().nullable().optional(),
    addressLine2: z.string().nullable().optional(),
    locality: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    postalCode: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    dateOfBirth: z.string().nullable().optional(),
    niNumber: z.string().nullable().optional(),
    personalUtrNumber: z.string().nullable().optional(),
    officerRole: z.string().nullable().optional(),
    isPrimaryContact: z.boolean().nullable().optional(),
  }).passthrough()),
  metadata: z.object({
    sentAt: z.string(),
    sentBy: z.string(),
    webhookName: z.string(),
    source: z.string().default("The Link"),
  }),
});
