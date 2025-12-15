import { db } from '../../db.js';
import { clients, clientServices, projects, projectTypes, clientTagAssignments, clientPeople, clientPortalUsers, communications, campaignRecipients, campaigns, clientEngagementScores } from '@shared/schema';
import { eq, and, sql, inArray, isNull, isNotNull, gte, lte, gt, lt, ne, or } from 'drizzle-orm';
import type { CampaignTargetCriteria } from '@shared/schema';
import { campaignTargetStorage } from '../../storage/campaigns/index.js';

export interface FilterDefinition {
  type: string;
  label: string;
  category: 'client_status' | 'services' | 'projects' | 'data_completeness' | 'engagement';
  operators: string[];
  valueType: 'boolean' | 'select' | 'multi_select' | 'number' | 'number_range' | 'date_range' | 'user_select' | 'service_select' | 'project_type_select' | 'stage_select';
  options?: { value: string; label: string }[];
}

export const FILTER_REGISTRY: FilterDefinition[] = [
  {
    type: 'client_type',
    label: 'Client Type',
    category: 'client_status',
    operators: ['equals'],
    valueType: 'select',
    options: [
      { value: 'company', label: 'Company' },
      { value: 'individual', label: 'Individual' }
    ]
  },
  {
    type: 'client_status',
    label: 'Company Status',
    category: 'client_status',
    operators: ['equals', 'not_equals', 'in', 'not_in'],
    valueType: 'multi_select',
    options: [
      { value: 'Active', label: 'Active' },
      { value: 'Dormant', label: 'Dormant' },
      { value: 'Dissolved', label: 'Dissolved' },
      { value: 'Liquidation', label: 'Liquidation' },
      { value: 'Prospect', label: 'Prospect' }
    ]
  },
  {
    type: 'client_manager',
    label: 'Client Manager',
    category: 'client_status',
    operators: ['equals', 'not_equals', 'in'],
    valueType: 'user_select'
  },
  {
    type: 'monthly_fee_range',
    label: 'Monthly Fee',
    category: 'client_status',
    operators: ['between', 'gt', 'lt', 'gte', 'lte'],
    valueType: 'number_range'
  },
  {
    type: 'has_tag',
    label: 'Has Tag',
    category: 'client_status',
    operators: ['equals', 'not_equals'],
    valueType: 'select'
  },
  {
    type: 'has_service',
    label: 'Has Service',
    category: 'services',
    operators: ['equals'],
    valueType: 'service_select'
  },
  {
    type: 'missing_service',
    label: 'Does NOT Have Service',
    category: 'services',
    operators: ['equals'],
    valueType: 'service_select'
  },
  {
    type: 'has_service_not_other',
    label: 'Has Service A but not B',
    category: 'services',
    operators: ['equals'],
    valueType: 'multi_select'
  },
  {
    type: 'has_project_type',
    label: 'Has Active Project Type',
    category: 'projects',
    operators: ['equals', 'not_equals'],
    valueType: 'project_type_select'
  },
  {
    type: 'project_at_stage',
    label: 'Has Project at Stage',
    category: 'projects',
    operators: ['equals'],
    valueType: 'stage_select'
  },
  {
    type: 'accounts_due_range',
    label: 'Accounts Due Within',
    category: 'projects',
    operators: ['between'],
    valueType: 'date_range'
  },
  {
    type: 'confirmation_statement_due_range',
    label: 'Confirmation Statement Due Within',
    category: 'projects',
    operators: ['between'],
    valueType: 'date_range'
  },
  {
    type: 'has_overdue_project',
    label: 'Has Overdue Project',
    category: 'projects',
    operators: ['equals'],
    valueType: 'boolean'
  },
  {
    type: 'vat_quarter_due_range',
    label: 'VAT Quarter Due Within',
    category: 'projects',
    operators: ['between'],
    valueType: 'date_range'
  },
  {
    type: 'missing_utr',
    label: 'Missing Company UTR',
    category: 'data_completeness',
    operators: ['equals'],
    valueType: 'boolean'
  },
  {
    type: 'missing_auth_code',
    label: 'Missing Companies House Auth Code',
    category: 'data_completeness',
    operators: ['equals'],
    valueType: 'boolean'
  },
  {
    type: 'missing_company_number',
    label: 'Missing Company Number',
    category: 'data_completeness',
    operators: ['equals'],
    valueType: 'boolean'
  },
  {
    type: 'docs_outstanding_days',
    label: 'Docs Outstanding More Than X Days',
    category: 'data_completeness',
    operators: ['gt'],
    valueType: 'number'
  },
  {
    type: 'opened_last_campaign',
    label: 'Opened Last Campaign',
    category: 'engagement',
    operators: ['equals'],
    valueType: 'boolean'
  },
  {
    type: 'clicked_last_campaign',
    label: 'Clicked Last Campaign',
    category: 'engagement',
    operators: ['equals'],
    valueType: 'boolean'
  },
  {
    type: 'last_contact_days',
    label: 'Last Contact More Than X Days Ago',
    category: 'engagement',
    operators: ['gt', 'lt'],
    valueType: 'number'
  },
  {
    type: 'portal_login_days',
    label: 'Portal Login Within X Days',
    category: 'engagement',
    operators: ['equals', 'not_equals'],
    valueType: 'number'
  },
  {
    type: 'engagement_score',
    label: 'Engagement Score',
    category: 'engagement',
    operators: ['gt', 'lt', 'between'],
    valueType: 'number_range'
  },
  {
    type: 'consecutive_ignored',
    label: 'Ignored X Consecutive Campaigns',
    category: 'engagement',
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
  if (!filter || !filter.options) return [];
  return typeof filter.options === 'function' ? await filter.options() : filter.options;
}

export async function applyFilters(filters: Array<{ filterType: string; operator: string; value: any }>): Promise<any[]> {
  const conditions = filters.map(f => buildFilterCondition(f.filterType, f.operator, f.value)).filter(Boolean);
  
  if (conditions.length === 0) {
    return db.select().from(clients);
  }
  
  return db.select().from(clients).where(and(...conditions));
}
