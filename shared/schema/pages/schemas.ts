import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import {
  pageTemplates,
  pages,
  pageComponents,
  pageActions,
  pageVisits,
  pageActionLogs,
} from './tables';

export const insertPageTemplateSchema = createInsertSchema(pageTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updatePageTemplateSchema = insertPageTemplateSchema.partial();

export const insertPageSchema = createInsertSchema(pages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updatePageSchema = insertPageSchema.partial();

export const insertPageComponentSchema = createInsertSchema(pageComponents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updatePageComponentSchema = insertPageComponentSchema.partial().omit({
  pageId: true,
});

export const insertPageActionSchema = createInsertSchema(pageActions).omit({
  id: true,
  createdAt: true,
});

export const updatePageActionSchema = insertPageActionSchema.partial().omit({
  pageId: true,
});

export const insertPageVisitSchema = createInsertSchema(pageVisits).omit({
  id: true,
  createdAt: true,
  firstViewedAt: true,
  lastViewedAt: true,
});

export const updatePageVisitSchema = insertPageVisitSchema.partial().omit({
  pageId: true,
  visitToken: true,
});

export const insertPageActionLogSchema = createInsertSchema(pageActionLogs).omit({
  id: true,
  timestamp: true,
});

export const textBlockContentSchema = z.object({
  html: z.string(),
  mergeFieldsUsed: z.array(z.string()).optional(),
});

export const headingContentSchema = z.object({
  text: z.string(),
  level: z.enum(['h1', 'h2', 'h3', 'h4']),
  mergeFieldsUsed: z.array(z.string()).optional(),
});

export const imageContentSchema = z.object({
  src: z.string(),
  alt: z.string().optional(),
  caption: z.string().optional(),
  width: z.number().optional(),
});

export const buttonContentSchema = z.object({
  label: z.string(),
  actionId: z.string().optional(),
  style: z.enum(['primary', 'secondary', 'outline', 'link']).optional(),
  icon: z.string().optional(),
});

export const calloutContentSchema = z.object({
  type: z.enum(['info', 'warning', 'success', 'error']),
  title: z.string().optional(),
  message: z.string(),
  icon: z.string().optional(),
});

export const formContentSchema = z.object({
  fields: z.array(z.object({
    name: z.string(),
    label: z.string(),
    type: z.enum(['text', 'email', 'phone', 'textarea', 'select', 'checkbox', 'date']),
    required: z.boolean().optional(),
    options: z.array(z.string()).optional(),
    placeholder: z.string().optional(),
  })),
  submitLabel: z.string().optional(),
  actionId: z.string().optional(),
});
