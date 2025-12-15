import { z } from 'zod';
import {
  pageTemplates,
  pages,
  pageComponents,
  pageActions,
  pageVisits,
  pageActionLogs,
} from './tables';
import {
  insertPageTemplateSchema,
  updatePageTemplateSchema,
  insertPageSchema,
  updatePageSchema,
  insertPageComponentSchema,
  updatePageComponentSchema,
  insertPageActionSchema,
  updatePageActionSchema,
  insertPageVisitSchema,
  updatePageVisitSchema,
  insertPageActionLogSchema,
  textBlockContentSchema,
  headingContentSchema,
  imageContentSchema,
  buttonContentSchema,
  calloutContentSchema,
  formContentSchema,
} from './schemas';

export type PageTemplate = typeof pageTemplates.$inferSelect;
export type InsertPageTemplate = z.infer<typeof insertPageTemplateSchema>;
export type UpdatePageTemplate = z.infer<typeof updatePageTemplateSchema>;

export type Page = typeof pages.$inferSelect;
export type InsertPage = z.infer<typeof insertPageSchema>;
export type UpdatePage = z.infer<typeof updatePageSchema>;

export type PageComponent = typeof pageComponents.$inferSelect;
export type InsertPageComponent = z.infer<typeof insertPageComponentSchema>;
export type UpdatePageComponent = z.infer<typeof updatePageComponentSchema>;

export type PageAction = typeof pageActions.$inferSelect;
export type InsertPageAction = z.infer<typeof insertPageActionSchema>;
export type UpdatePageAction = z.infer<typeof updatePageActionSchema>;

export type PageVisit = typeof pageVisits.$inferSelect;
export type InsertPageVisit = z.infer<typeof insertPageVisitSchema>;
export type UpdatePageVisit = z.infer<typeof updatePageVisitSchema>;

export type PageActionLog = typeof pageActionLogs.$inferSelect;
export type InsertPageActionLog = z.infer<typeof insertPageActionLogSchema>;

export type TextBlockContent = z.infer<typeof textBlockContentSchema>;
export type HeadingContent = z.infer<typeof headingContentSchema>;
export type ImageContent = z.infer<typeof imageContentSchema>;
export type ButtonContent = z.infer<typeof buttonContentSchema>;
export type CalloutContent = z.infer<typeof calloutContentSchema>;
export type FormContent = z.infer<typeof formContentSchema>;

export type PageComponentType = 
  | 'text_block' 
  | 'heading' 
  | 'image' 
  | 'table' 
  | 'button' 
  | 'form'
  | 'callout' 
  | 'status_widget' 
  | 'timeline' 
  | 'faq_accordion'
  | 'comparison_table' 
  | 'video_embed' 
  | 'document_list' 
  | 'spacer';

export type PageActionType = 
  | 'interested' 
  | 'not_interested' 
  | 'documents_uploaded' 
  | 'book_call'
  | 'request_callback' 
  | 'confirm_details' 
  | 'request_extension'
  | 'custom_form' 
  | 'custom_webhook';

export interface PageWithDetails extends Page {
  template?: PageTemplate | null;
  components: PageComponent[];
  actions: PageAction[];
}

export interface PageRenderContext {
  page: PageWithDetails;
  client: { id: string; name: string };
  person: { id: string; fullName: string; email?: string };
  recipientId?: string;
  visitToken: string;
}
