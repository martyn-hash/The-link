import { db } from '../../db.js';
import { clients, clientServices, projects, projectTypes, clientTagAssignments, clientPeople, clientPortalUsers, communications, campaignRecipients, campaigns, clientEngagementScores } from '@shared/schema';
import { eq, and, sql, inArray, isNull, isNotNull, gte, lte, gt, lt, ne, or } from 'drizzle-orm';
import type { CampaignTargetCriteria } from '@shared/schema';
import { campaignTargetStorage } from '../../storage/campaigns/index.js';

export interface FilterDefinition {
  type: string;
  label: string;
  description?: string;
  category: 'Client Profile' | 'Services' | 'Projects & Deadlines' | 'Data Completeness' | 'Engagement';
  operators: string[];
  valueType: 'boolean' | 'select' | 'multi_select' | 'number' | 'days' | 'range' | 'date_range' | 'user' | 'service' | 'service_pair' | 'project_type' | 'stage' | 'tag';
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}

export const FILTER_REGISTRY: FilterDefinition[] = [
  {
    type: 'client_manager',
    label: 'Assigned Manager',
    description: 'Filter by the manager assigned to the client',
    category: 'Client Profile',
    operators: ['in', 'not_in'],
    valueType: 'user'
  },
  {
    type: 'has_tag',
    label: 'Client Tag',
    description: 'Filter by tags assigned to clients',
    category: 'Client Profile',
    operators: ['in', 'not_in'],
    valueType: 'tag'
  },
  {
    type: 'has_service',
    label: 'Has Service',
    description: 'Include clients who have this service active',
    category: 'Services',
    operators: ['in'],
    valueType: 'service'
  },
  {
    type: 'missing_service',
    label: 'Does NOT Have Service',
    description: 'Include clients who do not have this service',
    category: 'Services',
    operators: ['in'],
    valueType: 'service'
  },
  {
    type: 'has_service_not_other',
    label: 'Has Service A but not B',
    description: 'Include clients with specific services but exclude those with others',
    category: 'Services',
    operators: ['equals'],
    valueType: 'service_pair'
  },
  {
    type: 'has_project_type',
    label: 'Has Active Project Type',
    description: 'Include clients with active projects of specific types',
    category: 'Projects & Deadlines',
    operators: ['in', 'not_in'],
    valueType: 'project_type'
  },
  {
    type: 'project_at_stage',
    label: 'Has Project at Stage',
    description: 'Include clients with projects at specific workflow stages',
    category: 'Projects & Deadlines',
    operators: ['equals'],
    valueType: 'stage'
  },
  {
    type: 'accounts_due_range',
    label: 'Accounts Due Within',
    description: 'Filter by when accounts are due for filing',
    category: 'Projects & Deadlines',
    operators: ['within'],
    valueType: 'date_range'
  },
  {
    type: 'confirmation_statement_due_range',
    label: 'Confirmation Statement Due Within',
    description: 'Filter by when confirmation statement is due',
    category: 'Projects & Deadlines',
    operators: ['within'],
    valueType: 'date_range'
  },
  {
    type: 'vat_quarter_due_range',
    label: 'VAT Quarter Due Within',
    description: 'Filter by when VAT returns are due (from VAT service)',
    category: 'Projects & Deadlines',
    operators: ['within'],
    valueType: 'date_range'
  },
  {
    type: 'missing_utr',
    label: 'Missing Company UTR',
    description: 'Include clients without a Unique Taxpayer Reference',
    category: 'Data Completeness',
    operators: ['equals'],
    valueType: 'boolean'
  },
  {
    type: 'missing_auth_code',
    label: 'Missing Companies House Auth Code',
    description: 'Include clients without Companies House authentication code',
    category: 'Data Completeness',
    operators: ['equals'],
    valueType: 'boolean'
  },
  {
    type: 'opened_last_campaign',
    label: 'Opened Last Campaign',
    description: 'Filter by whether they opened your last campaign',
    category: 'Engagement',
    operators: ['equals'],
    valueType: 'boolean'
  },
  {
    type: 'clicked_last_campaign',
    label: 'Clicked Last Campaign',
    description: 'Filter by whether they clicked a link in your last campaign',
    category: 'Engagement',
    operators: ['equals'],
    valueType: 'boolean'
  },
  {
    type: 'portal_login_days',
    label: 'Portal Login Within X Days',
    description: 'Filter by recent portal login activity',
    category: 'Engagement',
    operators: ['within', 'not_within'],
    valueType: 'days'
  },
  {
    type: 'engagement_score',
    label: 'Engagement Score',
    description: 'Filter by overall client engagement level (0-100)',
    category: 'Engagement',
    operators: ['between'],
    valueType: 'range',
    min: 0,
    max: 100
  },
  {
    type: 'consecutive_ignored',
    label: 'Ignored X Consecutive Campaigns',
    description: 'Include clients who have ignored multiple campaigns in a row',
    category: 'Engagement',
    operators: ['gte'],
    valueType: 'number'
  }
];

function buildFilterClause(filterType: string, operator: string, value: any): any {
  switch (filterType) {
    case 'client_type':
      return eq(clients.clientType, value);

    case 'client_status':
      if (operator === 'in' && Array.isArray(value)) {
        return inArray(clients.companyStatus, value);
      }
      if (operator === 'not_in' && Array.isArray(value)) {
        return sql`${clients.companyStatus} NOT IN (${sql.join(value.map((v: string) => sql`${v}`), sql`, `)})`;
      }
      if (operator === 'equals') return eq(clients.companyStatus, value);
      if (operator === 'not_equals') return ne(clients.companyStatus, value);
      break;

    case 'client_manager':
      if (operator === 'in' && Array.isArray(value)) {
        return inArray(clients.managerId, value);
      }
      if (operator === 'equals') return eq(clients.managerId, value);
      if (operator === 'not_equals') return ne(clients.managerId, value);
      break;

    case 'monthly_fee_range':
      if (operator === 'between' && value.min !== undefined && value.max !== undefined) {
        return and(
          gte(clients.monthlyChargeQuote, value.min),
          lte(clients.monthlyChargeQuote, value.max)
        );
      }
      if (operator === 'gt') return gt(clients.monthlyChargeQuote, value);
      if (operator === 'lt') return lt(clients.monthlyChargeQuote, value);
      if (operator === 'gte') return gte(clients.monthlyChargeQuote, value);
      if (operator === 'lte') return lte(clients.monthlyChargeQuote, value);
      break;

    case 'has_tag':
      if (operator === 'equals') {
        return sql`EXISTS (SELECT 1 FROM ${clientTagAssignments} WHERE ${clientTagAssignments.clientId} = ${clients.id} AND ${clientTagAssignments.tagId} = ${value})`;
      }
      if (operator === 'not_equals') {
        return sql`NOT EXISTS (SELECT 1 FROM ${clientTagAssignments} WHERE ${clientTagAssignments.clientId} = ${clients.id} AND ${clientTagAssignments.tagId} = ${value})`;
      }
      break;

    case 'has_service':
      return sql`EXISTS (SELECT 1 FROM ${clientServices} WHERE ${clientServices.clientId} = ${clients.id} AND ${clientServices.serviceId} = ${value} AND ${clientServices.isActive} = true)`;

    case 'missing_service':
      return sql`NOT EXISTS (SELECT 1 FROM ${clientServices} WHERE ${clientServices.clientId} = ${clients.id} AND ${clientServices.serviceId} = ${value} AND ${clientServices.isActive} = true)`;

    case 'has_service_not_other':
      if (Array.isArray(value) && value.length >= 2) {
        return sql`
          EXISTS (SELECT 1 FROM ${clientServices} WHERE ${clientServices.clientId} = ${clients.id} AND ${clientServices.serviceId} = ${value[0]} AND ${clientServices.isActive} = true)
          AND NOT EXISTS (SELECT 1 FROM ${clientServices} WHERE ${clientServices.clientId} = ${clients.id} AND ${clientServices.serviceId} = ${value[1]} AND ${clientServices.isActive} = true)
        `;
      }
      break;

    case 'has_project_type':
      if (operator === 'equals') {
        return sql`EXISTS (SELECT 1 FROM projects WHERE projects.client_id = ${clients.id} AND projects.project_type_id = ${value} AND projects.archived = false AND projects.inactive = false)`;
      }
      if (operator === 'not_equals') {
        return sql`NOT EXISTS (SELECT 1 FROM projects WHERE projects.client_id = ${clients.id} AND projects.project_type_id = ${value} AND projects.archived = false AND projects.inactive = false)`;
      }
      break;

    case 'project_at_stage':
      if (value.projectTypeId && value.stageId) {
        return sql`EXISTS (SELECT 1 FROM projects WHERE projects.client_id = ${clients.id} AND projects.project_type_id = ${value.projectTypeId} AND projects.current_status = ${value.stageId} AND projects.archived = false AND projects.inactive = false)`;
      }
      break;

    case 'accounts_due_range':
      if (value.from && value.to) {
        return and(
          gte(clients.nextAccountsDue, new Date(value.from)),
          lte(clients.nextAccountsDue, new Date(value.to))
        );
      }
      break;

    case 'confirmation_statement_due_range':
      if (value.from && value.to) {
        return and(
          gte(clients.confirmationStatementNextDue, new Date(value.from)),
          lte(clients.confirmationStatementNextDue, new Date(value.to))
        );
      }
      break;

    case 'has_overdue_project':
      if (value === true) {
        return sql`EXISTS (SELECT 1 FROM projects WHERE projects.client_id = ${clients.id} AND projects.due_date < NOW() AND projects.archived = false AND projects.inactive = false)`;
      }
      return sql`NOT EXISTS (SELECT 1 FROM projects WHERE projects.client_id = ${clients.id} AND projects.due_date < NOW() AND projects.archived = false AND projects.inactive = false)`;

    case 'vat_quarter_due_range':
      if (value.from && value.to) {
        return sql`EXISTS (SELECT 1 FROM projects p JOIN project_types pt ON p.project_type_id = pt.id WHERE p.client_id = ${clients.id} AND pt.name ILIKE '%VAT%' AND p.due_date BETWEEN ${new Date(value.from)} AND ${new Date(value.to)} AND p.archived = false AND p.inactive = false)`;
      }
      break;

    case 'missing_utr':
      if (value === true) {
        return or(isNull(clients.companyUtr), eq(clients.companyUtr, ''));
      }
      return and(isNotNull(clients.companyUtr), ne(clients.companyUtr, ''));

    case 'missing_auth_code':
      if (value === true) {
        return or(isNull(clients.companiesHouseAuthCode), eq(clients.companiesHouseAuthCode, ''));
      }
      return and(isNotNull(clients.companiesHouseAuthCode), ne(clients.companiesHouseAuthCode, ''));

    case 'missing_company_number':
      if (value === true) {
        return or(isNull(clients.companyNumber), eq(clients.companyNumber, ''));
      }
      return and(isNotNull(clients.companyNumber), ne(clients.companyNumber, ''));

    case 'docs_outstanding_days':
      return sql`EXISTS (SELECT 1 FROM task_instances ti JOIN tasks t ON ti.task_id = t.id WHERE ti.client_id = ${clients.id} AND t.is_doc_request = true AND ti.status = 'pending' AND ti.created_at < NOW() - INTERVAL '${sql.raw(String(value))} days')`;

    case 'opened_last_campaign':
      if (value === true) {
        return sql`EXISTS (
          SELECT 1 FROM ${campaignRecipients} cr
          JOIN ${campaigns} c ON cr.campaign_id = c.id
          WHERE cr.client_id = ${clients.id} 
          AND c.status = 'sent'
          AND cr.opened_at IS NOT NULL
          ORDER BY cr.sent_at DESC LIMIT 1
        )`;
      }
      return sql`EXISTS (
        SELECT 1 FROM ${campaignRecipients} cr
        JOIN ${campaigns} c ON cr.campaign_id = c.id
        WHERE cr.client_id = ${clients.id} 
        AND c.status = 'sent'
        AND cr.opened_at IS NULL
        ORDER BY cr.sent_at DESC LIMIT 1
      )`;

    case 'clicked_last_campaign':
      if (value === true) {
        return sql`EXISTS (
          SELECT 1 FROM ${campaignRecipients} cr
          JOIN ${campaigns} c ON cr.campaign_id = c.id
          WHERE cr.client_id = ${clients.id} 
          AND c.status = 'sent'
          AND cr.clicked_at IS NOT NULL
          ORDER BY cr.sent_at DESC LIMIT 1
        )`;
      }
      return sql`EXISTS (
        SELECT 1 FROM ${campaignRecipients} cr
        JOIN ${campaigns} c ON cr.campaign_id = c.id
        WHERE cr.client_id = ${clients.id} 
        AND c.status = 'sent'
        AND cr.clicked_at IS NULL
        ORDER BY cr.sent_at DESC LIMIT 1
      )`;

    case 'last_contact_days':
      if (operator === 'gt') {
        return sql`(SELECT MAX(logged_at) FROM ${communications} WHERE ${communications.clientId} = ${clients.id}) < NOW() - INTERVAL '${sql.raw(String(value))} days'`;
      }
      if (operator === 'lt') {
        return sql`(SELECT MAX(logged_at) FROM ${communications} WHERE ${communications.clientId} = ${clients.id}) > NOW() - INTERVAL '${sql.raw(String(value))} days'`;
      }
      break;

    case 'portal_login_days':
      if (operator === 'equals') {
        return sql`EXISTS (SELECT 1 FROM ${clientPortalUsers} WHERE ${clientPortalUsers.clientId} = ${clients.id} AND ${clientPortalUsers.lastLogin} > NOW() - INTERVAL '${sql.raw(String(value))} days')`;
      }
      if (operator === 'not_equals') {
        return sql`NOT EXISTS (SELECT 1 FROM ${clientPortalUsers} WHERE ${clientPortalUsers.clientId} = ${clients.id} AND ${clientPortalUsers.lastLogin} > NOW() - INTERVAL '${sql.raw(String(value))} days')`;
      }
      break;

    case 'engagement_score':
      if (operator === 'gt') {
        return sql`(SELECT total_score FROM ${clientEngagementScores} WHERE ${clientEngagementScores.clientId} = ${clients.id}) > ${value}`;
      }
      if (operator === 'lt') {
        return sql`(SELECT total_score FROM ${clientEngagementScores} WHERE ${clientEngagementScores.clientId} = ${clients.id}) < ${value}`;
      }
      if (operator === 'between' && value.min !== undefined && value.max !== undefined) {
        return sql`(SELECT total_score FROM ${clientEngagementScores} WHERE ${clientEngagementScores.clientId} = ${clients.id}) BETWEEN ${value.min} AND ${value.max}`;
      }
      break;

    case 'consecutive_ignored':
      return sql`(SELECT consecutive_ignored FROM ${clientEngagementScores} WHERE ${clientEngagementScores.clientId} = ${clients.id}) >= ${value}`;
  }

  return sql`1=1`;
}

function groupBy<T>(arr: T[], key: keyof T): Record<string | number, T[]> {
  return arr.reduce((acc, item) => {
    const k = String(item[key] ?? 0);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string | number, T[]>);
}

export async function buildTargetQuery(criteria: CampaignTargetCriteria[]) {
  if (criteria.length === 0) {
    return db.select().from(clients).where(sql`1=0`);
  }

  const groups = groupBy(criteria, 'filterGroup');
  const groupClauses: any[] = [];

  for (const groupKey of Object.keys(groups)) {
    const groupCriteria = groups[groupKey].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const andClauses = groupCriteria.map(c => {
      const val = c.value as any;
      return buildFilterClause(c.filterType, c.operator, val);
    });

    if (andClauses.length === 1) {
      groupClauses.push(andClauses[0]);
    } else if (andClauses.length > 1) {
      groupClauses.push(and(...andClauses));
    }
  }

  if (groupClauses.length === 0) {
    return db.select().from(clients).where(sql`1=0`);
  }

  if (groupClauses.length === 1) {
    return db.selectDistinct().from(clients).where(groupClauses[0]);
  }

  return db.selectDistinct().from(clients).where(or(...groupClauses));
}

export async function getMatchingClientCount(campaignId: string): Promise<number> {
  const criteria = await campaignTargetStorage.getByCampaignId(campaignId);
  if (criteria.length === 0) return 0;

  const matchedClients = await buildTargetQuery(criteria);
  return matchedClients.length;
}

export async function getMatchingClients(campaignId: string, limit = 100, offset = 0): Promise<typeof clients.$inferSelect[]> {
  const criteria = await campaignTargetStorage.getByCampaignId(campaignId);
  if (criteria.length === 0) return [];

  const groups = groupBy(criteria, 'filterGroup');
  const groupClauses: any[] = [];

  for (const groupKey of Object.keys(groups)) {
    const groupCriteria = groups[groupKey].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const andClauses = groupCriteria.map(c => {
      const val = c.value as any;
      return buildFilterClause(c.filterType, c.operator, val);
    });

    if (andClauses.length === 1) {
      groupClauses.push(andClauses[0]);
    } else if (andClauses.length > 1) {
      groupClauses.push(and(...andClauses));
    }
  }

  if (groupClauses.length === 0) {
    return [];
  }

  let query = db.selectDistinct().from(clients);
  
  if (groupClauses.length === 1) {
    query = query.where(groupClauses[0]) as typeof query;
  } else {
    query = query.where(or(...groupClauses)) as typeof query;
  }

  query = query.orderBy(clients.name) as typeof query;
  query = query.limit(limit) as typeof query;
  query = query.offset(offset) as typeof query;

  return query;
}

export async function previewTargetedClients(
  criteria: CampaignTargetCriteria[],
  limit = 20
): Promise<{ clients: typeof clients.$inferSelect[]; totalCount: number }> {
  if (criteria.length === 0) {
    return { clients: [], totalCount: 0 };
  }

  const groups = groupBy(criteria, 'filterGroup');
  const groupClauses: any[] = [];

  for (const groupKey of Object.keys(groups)) {
    const groupCriteria = groups[groupKey].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const andClauses = groupCriteria.map(c => {
      const val = c.value as any;
      return buildFilterClause(c.filterType, c.operator, val);
    });

    if (andClauses.length === 1) {
      groupClauses.push(andClauses[0]);
    } else if (andClauses.length > 1) {
      groupClauses.push(and(...andClauses));
    }
  }

  if (groupClauses.length === 0) {
    return { clients: [], totalCount: 0 };
  }

  const whereClause = groupClauses.length === 1 ? groupClauses[0] : or(...groupClauses);

  const allResults = await db.selectDistinct().from(clients).where(whereClause);
  const pagedResults = await db.selectDistinct().from(clients).where(whereClause).limit(limit);

  return {
    clients: pagedResults,
    totalCount: allResults.length
  };
}

export function getFilterRegistry(): FilterDefinition[] {
  return FILTER_REGISTRY;
}

export function getFiltersByCategory(category: string): FilterDefinition[] {
  return FILTER_REGISTRY.filter(f => f.category === category);
}

export function getAvailableFilters(): FilterDefinition[] {
  return FILTER_REGISTRY;
}

export async function getFilterOptions(filterType: string): Promise<any[]> {
  const filter = FILTER_REGISTRY.find(f => f.type === filterType);
  if (filter?.options) return filter.options;
  
  switch (filterType) {
    case 'user':
    case 'client_manager': {
      const users = await db.query.users.findMany({
        columns: { id: true, firstName: true, lastName: true, email: true },
        where: (users: any, { eq }: any) => eq(users.isActive, true)
      });
      return users.map((u: any) => ({
        value: u.id,
        label: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email
      }));
    }
    case 'service':
    case 'has_service':
    case 'missing_service': {
      const services = await db.query.services.findMany({
        columns: { id: true, name: true },
        where: (services: any, { eq }: any) => eq(services.isActive, true)
      });
      return services.map((s: any) => ({ value: s.id, label: s.name }));
    }
    case 'project_type':
    case 'has_project_type': {
      const types = await db.query.projectTypes.findMany({
        columns: { id: true, name: true },
        where: (pt: any, { eq }: any) => eq(pt.isActive, true)
      });
      return types.map((t: any) => ({ value: t.id, label: t.name }));
    }
    case 'tag':
    case 'has_tag': {
      const result = await db.execute(sql`SELECT id, name FROM client_tags WHERE deleted_at IS NULL ORDER BY name`);
      return (result.rows as any[]).map((t: any) => ({ value: t.id, label: t.name }));
    }
    default:
      return [];
  }
}

export async function applyFilters(filters: Array<{ filterType: string; operator: string; value: any }>): Promise<any[]> {
  const conditions = filters.map(f => buildFilterClause(f.filterType, f.operator, f.value)).filter(Boolean);
  
  if (conditions.length === 0) {
    return db.select().from(clients);
  }
  
  return db.select().from(clients).where(and(...conditions));
}
