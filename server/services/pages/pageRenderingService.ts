import { db } from '../../db.js';
import { pages, pageComponents, pageActions, pageVisits, campaignRecipients, clients, people, campaigns } from '@shared/schema';
import { eq, and, asc } from 'drizzle-orm';
import { pageStorage, pageComponentStorage, pageActionStorage, pageVisitStorage } from '../../storage/pages/index.js';
import { renderTemplate, resolveMergeData } from '../campaigns/mergeFieldService.js';

export interface RenderedPage {
  id: string;
  name: string;
  slug: string;
  headerTitle: string | null;
  headerSubtitle: string | null;
  headerImagePath: string | null;
  themeColor: string | null;
  backgroundColor: string | null;
  layoutType: string | null;
  components: RenderedComponent[];
  actions: RenderedAction[];
  visitToken: string;
  isOtpVerified: boolean;
}

export interface RenderedComponent {
  id: string;
  componentType: string;
  sectionIndex: number;
  rowIndex: number;
  columnIndex: number;
  columnSpan: number;
  sortOrder: number;
  content: any;
}

export interface RenderedAction {
  id: string;
  actionType: string;
  label: string;
  description: string | null;
  requiresOtp: boolean;
  isEnabled: boolean;
  sortOrder: number;
}

export async function renderPageForRecipient(
  pageSlug: string,
  visitToken: string
): Promise<RenderedPage | null> {
  const page = await pageStorage.getBySlug(pageSlug);
  if (!page) return null;

  if (!page.isPublished) {
    return null;
  }

  if (page.expiresAt && new Date(page.expiresAt) < new Date()) {
    return null;
  }

  const visit = await pageVisitStorage.getByToken(visitToken);
  if (!visit) return null;

  const recipient = visit.recipientId 
    ? await db.select().from(campaignRecipients).where(eq(campaignRecipients.id, visit.recipientId)).then(r => r[0])
    : null;

  const [client] = await db.select().from(clients).where(eq(clients.id, visit.clientId));
  const [person] = await db.select().from(people).where(eq(people.id, visit.personId));
  const campaign = page.campaignId
    ? await db.select().from(campaigns).where(eq(campaigns.id, page.campaignId)).then(r => r[0])
    : null;

  const mergeData = await resolveMergeData(
    visit.clientId,
    visit.personId,
    page.campaignId || ''
  );

  const components = await pageComponentStorage.getByPageId(page.id);
  const actions = await pageActionStorage.getByPageId(page.id);

  const renderedComponents = components.map(comp => ({
    id: comp.id,
    componentType: comp.componentType,
    sectionIndex: comp.sectionIndex ?? 0,
    rowIndex: comp.rowIndex ?? 0,
    columnIndex: comp.columnIndex ?? 0,
    columnSpan: comp.columnSpan ?? 1,
    sortOrder: comp.sortOrder ?? 0,
    content: renderComponentContent(comp.componentType, comp.content, mergeData),
  }));

  const renderedActions = actions.map(action => ({
    id: action.id,
    actionType: action.actionType,
    label: renderTemplate(action.label, mergeData),
    description: action.description ? renderTemplate(action.description, mergeData) : null,
    requiresOtp: action.requiresOtp ?? false,
    isEnabled: action.isEnabled ?? true,
    sortOrder: action.sortOrder ?? 0,
  }));

  await pageVisitStorage.update(visit.id, {
    lastViewedAt: new Date(),
    viewCount: (visit.viewCount ?? 1) + 1,
  });

  return {
    id: page.id,
    name: page.name,
    slug: page.slug,
    headerTitle: page.headerTitle ? renderTemplate(page.headerTitle, mergeData) : null,
    headerSubtitle: page.headerSubtitle ? renderTemplate(page.headerSubtitle, mergeData) : null,
    headerImagePath: page.headerImagePath,
    themeColor: page.themeColor,
    backgroundColor: page.backgroundColor,
    layoutType: page.layoutType,
    components: renderedComponents.sort((a, b) => {
      if (a.sectionIndex !== b.sectionIndex) return a.sectionIndex - b.sectionIndex;
      if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex;
      if (a.columnIndex !== b.columnIndex) return a.columnIndex - b.columnIndex;
      return a.sortOrder - b.sortOrder;
    }),
    actions: renderedActions.sort((a, b) => a.sortOrder - b.sortOrder),
    visitToken,
    isOtpVerified: !!visit.otpVerifiedAt,
  };
}

function renderComponentContent(componentType: string, content: any, mergeData: any): any {
  if (!content) return content;

  switch (componentType) {
    case 'text_block':
    case 'heading':
      return {
        ...content,
        text: content.text ? renderTemplate(content.text, mergeData) : content.text,
      };

    case 'callout':
      return {
        ...content,
        title: content.title ? renderTemplate(content.title, mergeData) : content.title,
        message: content.message ? renderTemplate(content.message, mergeData) : content.message,
      };

    case 'button':
      return {
        ...content,
        label: content.label ? renderTemplate(content.label, mergeData) : content.label,
      };

    case 'status_widget':
      return {
        ...content,
        clientName: mergeData.client?.name,
        managerName: mergeData.client?.managerName,
        nextAccountsDue: mergeData.client?.nextAccountsDue,
        confirmationStatementNextDue: mergeData.client?.confirmationStatementNextDue,
      };

    case 'table':
      if (content.rows && Array.isArray(content.rows)) {
        return {
          ...content,
          rows: content.rows.map((row: any) => ({
            ...row,
            cells: row.cells?.map((cell: string) => renderTemplate(cell, mergeData)) || [],
          })),
        };
      }
      return content;

    case 'faq_accordion':
      if (content.items && Array.isArray(content.items)) {
        return {
          ...content,
          items: content.items.map((item: any) => ({
            question: item.question ? renderTemplate(item.question, mergeData) : item.question,
            answer: item.answer ? renderTemplate(item.answer, mergeData) : item.answer,
          })),
        };
      }
      return content;

    default:
      return content;
  }
}

export async function createVisitToken(
  pageId: string,
  recipientId: string | null,
  clientId: string,
  personId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const token = generateVisitToken();
  
  await pageVisitStorage.create({
    pageId,
    recipientId,
    clientId,
    personId,
    visitToken: token,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
  });

  return token;
}

function generateVisitToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function getPagePreview(pageId: string, sampleClientId?: string, samplePersonId?: string): Promise<RenderedPage | null> {
  const page = await pageStorage.getById(pageId);
  if (!page) return null;

  let mergeData: any = {
    client: { name: 'Sample Client Ltd', tradingAs: '', companyNumber: '12345678' },
    person: { fullName: 'John Smith', firstName: 'John', lastName: 'Smith', email: 'john@example.com' },
    campaign: { name: page.name, pageUrl: '' },
    firm: { name: 'Your Firm', phone: '01onal 123456', email: 'info@firm.com', website: 'www.firm.com' },
  };

  if (sampleClientId && samplePersonId) {
    mergeData = await resolveMergeData(sampleClientId, samplePersonId, page.campaignId || '');
  }

  const components = await pageComponentStorage.getByPageId(page.id);
  const actions = await pageActionStorage.getByPageId(page.id);

  const renderedComponents = components.map(comp => ({
    id: comp.id,
    componentType: comp.componentType,
    sectionIndex: comp.sectionIndex ?? 0,
    rowIndex: comp.rowIndex ?? 0,
    columnIndex: comp.columnIndex ?? 0,
    columnSpan: comp.columnSpan ?? 1,
    sortOrder: comp.sortOrder ?? 0,
    content: renderComponentContent(comp.componentType, comp.content, mergeData),
  }));

  const renderedActions = actions.map(action => ({
    id: action.id,
    actionType: action.actionType,
    label: renderTemplate(action.label, mergeData),
    description: action.description ? renderTemplate(action.description, mergeData) : null,
    requiresOtp: action.requiresOtp ?? false,
    isEnabled: action.isEnabled ?? true,
    sortOrder: action.sortOrder ?? 0,
  }));

  return {
    id: page.id,
    name: page.name,
    slug: page.slug,
    headerTitle: page.headerTitle ? renderTemplate(page.headerTitle, mergeData) : null,
    headerSubtitle: page.headerSubtitle ? renderTemplate(page.headerSubtitle, mergeData) : null,
    headerImagePath: page.headerImagePath,
    themeColor: page.themeColor,
    backgroundColor: page.backgroundColor,
    layoutType: page.layoutType,
    components: renderedComponents.sort((a, b) => {
      if (a.sectionIndex !== b.sectionIndex) return a.sectionIndex - b.sectionIndex;
      if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex;
      if (a.columnIndex !== b.columnIndex) return a.columnIndex - b.columnIndex;
      return a.sortOrder - b.sortOrder;
    }),
    actions: renderedActions.sort((a, b) => a.sortOrder - b.sortOrder),
    visitToken: 'preview',
    isOtpVerified: true,
  };
}
