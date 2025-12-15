import { db } from '../../db.js';
import { clients, people, users, campaigns } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface MergeData {
  client: {
    id: string;
    name: string;
    tradingAs?: string;
    companyNumber?: string;
    nextAccountsDue?: string;
    confirmationStatementNextDue?: string;
    managerName?: string;
    managerEmail?: string;
    email?: string;
  };
  person: {
    id: string;
    fullName: string;
    firstName?: string;
    lastName?: string;
    title?: string;
    email?: string;
    telephone?: string;
    officerRole?: string;
  };
  campaign: {
    id: string;
    name: string;
    pageUrl?: string;
    unsubscribeUrl?: string;
  };
  firm: {
    name: string;
    phone?: string;
    email?: string;
    website?: string;
  };
}

export async function resolveMergeData(
  clientId: string,
  personId: string,
  campaignId: string,
  baseUrl?: string
): Promise<MergeData> {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
  const [person] = await db.select().from(people).where(eq(people.id, personId));
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));

  let manager: { firstName: string | null; lastName: string | null; email: string | null } | undefined;
  if (client?.managerId) {
    const [mgr] = await db
      .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
      .from(users)
      .where(eq(users.id, client.managerId));
    manager = mgr;
  }
  const managerFullName = manager ? [manager.firstName, manager.lastName].filter(Boolean).join(' ') : undefined;

  const appBaseUrl = baseUrl || process.env.BASE_URL || 'https://thelink.app';
  const pageUrl = campaign?.pageId ? `${appBaseUrl}/p/${campaign.pageId}` : undefined;
  const unsubscribeUrl = `${appBaseUrl}/preferences/{{token}}`;

  const nameParts = (person?.fullName || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  return {
    client: {
      id: client?.id || clientId,
      name: client?.name || '',
      tradingAs: client?.tradingAs || undefined,
      companyNumber: client?.companyNumber || undefined,
      nextAccountsDue: client?.nextAccountsDue ? formatDate(client.nextAccountsDue) : undefined,
      confirmationStatementNextDue: client?.confirmationStatementNextDue ? formatDate(client.confirmationStatementNextDue) : undefined,
      managerName: managerFullName || undefined,
      managerEmail: manager?.email || undefined,
      email: client?.email || undefined,
    },
    person: {
      id: person?.id || personId,
      fullName: person?.fullName || '',
      firstName,
      lastName,
      title: person?.title || undefined,
      email: person?.email || undefined,
      telephone: person?.telephone || undefined,
      officerRole: undefined,
    },
    campaign: {
      id: campaign?.id || campaignId,
      name: campaign?.name || '',
      pageUrl,
      unsubscribeUrl,
    },
    firm: {
      name: process.env.FIRM_NAME || 'Your Firm',
      phone: process.env.FIRM_PHONE || undefined,
      email: process.env.FIRM_EMAIL || undefined,
      website: process.env.FIRM_WEBSITE || undefined,
    },
  };
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function renderTemplate(template: string, mergeData: MergeData, preferenceToken?: string): string {
  let result = template;

  result = result.replace(/\{\{client\.name\}\}/g, mergeData.client.name);
  result = result.replace(/\{\{client\.tradingAs\}\}/g, mergeData.client.tradingAs || mergeData.client.name);
  result = result.replace(/\{\{client\.companyNumber\}\}/g, mergeData.client.companyNumber || '');
  result = result.replace(/\{\{client\.nextAccountsDue\}\}/g, mergeData.client.nextAccountsDue || '');
  result = result.replace(/\{\{client\.confirmationStatementNextDue\}\}/g, mergeData.client.confirmationStatementNextDue || '');
  result = result.replace(/\{\{client\.manager\.name\}\}/g, mergeData.client.managerName || '');
  result = result.replace(/\{\{client\.manager\.email\}\}/g, mergeData.client.managerEmail || '');

  result = result.replace(/\{\{person\.fullName\}\}/g, mergeData.person.fullName);
  result = result.replace(/\{\{person\.firstName\}\}/g, mergeData.person.firstName || '');
  result = result.replace(/\{\{person\.lastName\}\}/g, mergeData.person.lastName || '');
  result = result.replace(/\{\{person\.title\}\}/g, mergeData.person.title || '');
  result = result.replace(/\{\{person\.email\}\}/g, mergeData.person.email || '');
  result = result.replace(/\{\{person\.telephone\}\}/g, mergeData.person.telephone || '');
  result = result.replace(/\{\{person\.role\}\}/g, mergeData.person.officerRole || '');

  result = result.replace(/\{\{campaign\.name\}\}/g, mergeData.campaign.name);
  result = result.replace(/\{\{campaign\.pageUrl\}\}/g, mergeData.campaign.pageUrl || '');
  
  if (preferenceToken) {
    const unsubUrl = mergeData.campaign.unsubscribeUrl?.replace('{{token}}', preferenceToken) || '';
    result = result.replace(/\{\{campaign\.unsubscribeUrl\}\}/g, unsubUrl);
  } else {
    result = result.replace(/\{\{campaign\.unsubscribeUrl\}\}/g, mergeData.campaign.unsubscribeUrl || '');
  }

  result = result.replace(/\{\{firm\.name\}\}/g, mergeData.firm.name);
  result = result.replace(/\{\{firm\.phone\}\}/g, mergeData.firm.phone || '');
  result = result.replace(/\{\{firm\.email\}\}/g, mergeData.firm.email || '');
  result = result.replace(/\{\{firm\.website\}\}/g, mergeData.firm.website || '');

  result = result.replace(/\{\{([^|]+)\s*\|\s*fallback:\s*([^}]+)\}\}/g, (match, field, fallback) => {
    const trimmedField = field.trim();
    const trimmedFallback = fallback.trim().replace(/^["']|["']$/g, '');
    
    const value = getNestedValue(mergeData, trimmedField);
    return value || trimmedFallback;
  });

  result = result.replace(/\{\{[^}]+\}\}/g, '');

  return result;
}

function getNestedValue(obj: any, path: string): string | undefined {
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  
  return typeof current === 'string' ? current : undefined;
}

export interface RenderedContent {
  subject?: string;
  body?: string;
  plainTextBody?: string;
  smsContent?: string;
  voiceScript?: string;
}

export async function renderMessageForRecipient(
  message: {
    channel: string;
    subject?: string | null;
    body?: string | null;
    plainTextBody?: string | null;
    voiceScript?: string | null;
  },
  mergeData: MergeData,
  preferenceToken?: string
): Promise<RenderedContent> {
  const result: RenderedContent = {};

  if (message.subject) {
    result.subject = renderTemplate(message.subject, mergeData, preferenceToken);
  }

  if (message.body) {
    result.body = renderTemplate(message.body, mergeData, preferenceToken);
  }

  if (message.plainTextBody) {
    result.plainTextBody = renderTemplate(message.plainTextBody, mergeData, preferenceToken);
  } else if (message.body) {
    result.plainTextBody = stripHtml(result.body || message.body);
  }

  if (message.channel === 'sms' && message.body) {
    result.smsContent = renderTemplate(message.body, mergeData, preferenceToken);
  }

  if (message.voiceScript) {
    result.voiceScript = renderTemplate(message.voiceScript, mergeData, preferenceToken);
  }

  return result;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractMergeFields(template: string): string[] {
  const regex = /\{\{([^}|]+)(?:\|[^}]*)?\}\}/g;
  const fields: string[] = [];
  let match;

  while ((match = regex.exec(template)) !== null) {
    const field = match[1].trim();
    if (!fields.includes(field)) {
      fields.push(field);
    }
  }

  return fields;
}

export function getAvailableMergeFields(): Array<{ field: string; description: string; category: string }> {
  return [
    { field: '{{client.name}}', description: 'Client company name', category: 'client' },
    { field: '{{client.tradingAs}}', description: 'Trading name', category: 'client' },
    { field: '{{client.companyNumber}}', description: 'Company registration number', category: 'client' },
    { field: '{{client.managerName}}', description: 'Client manager name', category: 'client' },
    { field: '{{client.managerEmail}}', description: 'Client manager email', category: 'client' },
    { field: '{{client.nextAccountsDue}}', description: 'Next accounts due date', category: 'client' },
    { field: '{{client.confirmationStatementNextDue}}', description: 'Next CS due date', category: 'client' },
    { field: '{{person.fullName}}', description: 'Contact full name', category: 'person' },
    { field: '{{person.firstName}}', description: 'Contact first name', category: 'person' },
    { field: '{{person.lastName}}', description: 'Contact last name', category: 'person' },
    { field: '{{person.email}}', description: 'Contact email address', category: 'person' },
    { field: '{{person.telephone}}', description: 'Contact phone number', category: 'person' },
    { field: '{{campaign.name}}', description: 'Campaign name', category: 'campaign' },
    { field: '{{campaign.pageUrl}}', description: 'Campaign page link', category: 'campaign' },
    { field: '{{campaign.unsubscribeUrl}}', description: 'Unsubscribe link', category: 'campaign' },
    { field: '{{firm.name}}', description: 'Your firm name', category: 'firm' },
    { field: '{{firm.phone}}', description: 'Your firm phone', category: 'firm' },
    { field: '{{firm.email}}', description: 'Your firm email', category: 'firm' },
    { field: '{{firm.website}}', description: 'Your firm website', category: 'firm' },
  ];
}

export async function validateMergeFields(
  campaignId: string,
  sampleClientId?: string,
  samplePersonId?: string
): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];

  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!campaign) {
    return { valid: false, issues: ['Campaign not found'] };
  }

  return { valid: issues.length === 0, issues };
}
