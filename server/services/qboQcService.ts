import { storage } from '../storage';
import { makeQboApiRequest, refreshAccessToken, encryptTokens, decryptTokens, isAccessTokenExpired, calculateTokenExpiry } from './quickbooks';
import { QboConnection, QboQcRun, QboQcResult, QboQcResultItem, InsertQboQcRun, InsertQboQcResult, InsertQboQcResultItem } from '@shared/schema';

export type QcStatus = 'pass' | 'warning' | 'fail' | 'blocked';
export type QcSection = 'period_control' | 'bank_cash' | 'sales_ar' | 'purchases_ap' | 'vat' | 'journals' | 'attachments' | 'master_data' | 'analytics';
export type QcErrorCategory = 'rate_limit' | 'auth' | 'permission' | 'query_syntax' | 'feature_unavailable' | 'network' | 'unknown';

export interface QcCheckContext {
  accessToken: string;
  realmId: string;
  periodStart: Date;
  periodEnd: Date;
  connection: QboConnection;
  apiCallTracker: ApiCallTracker;
}

export interface QcCheckResult {
  checkCode: string;
  checkName: string;
  section: QcSection;
  status: QcStatus;
  value?: string;
  expected?: string;
  summary: string;
  items?: QcResultItemData[];
  metadata?: Record<string, unknown>;
  errorCategory?: QcErrorCategory;
  errorDetails?: string;
}

export interface QcResultItemData {
  externalId?: string;
  externalType?: string;
  label: string;
  description?: string;
  amount?: number;
  txnDate?: Date;
  metadata?: Record<string, unknown>;
}

export interface QcCheck {
  code: string;
  name: string;
  section: QcSection;
  description: string;
  execute(context: QcCheckContext): Promise<QcCheckResult>;
}

interface QcApiError extends Error {
  statusCode?: number;
  category: QcErrorCategory;
  isRetryable: boolean;
  userMessage: string;
}

function parseStatusCode(value: any): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 100 && value < 600) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= 100 && parsed < 600) {
      return parsed;
    }
  }
  return undefined;
}

function classifyApiError(error: any): QcApiError {
  const statusCode = 
    parseStatusCode(error.statusCode) || 
    parseStatusCode(error.status) || 
    parseStatusCode(error.response?.status) ||
    parseStatusCode(error.response?.statusCode) ||
    parseStatusCode(error.fault?.error?.[0]?.code) ||
    (error.message?.match(/\b([45]\d{2})\b/) ? parseInt(error.message.match(/\b([45]\d{2})\b/)[1]) : undefined);
  
  const stringCode = typeof error.code === 'string' ? error.code.toLowerCase() : '';
  
  const rawMessage = 
    error.message || 
    error.fault?.error?.[0]?.message ||
    error.response?.data?.message ||
    'Unknown error';
  
  const message = rawMessage.toLowerCase();
  
  let category: QcErrorCategory = 'unknown';
  let isRetryable = false;
  let userMessage = 'An unexpected error occurred';
  
  if (statusCode === 429) {
    category = 'rate_limit';
    isRetryable = true;
    userMessage = 'QuickBooks API rate limit reached. Please try again in a few minutes.';
  } else if (statusCode === 401) {
    category = 'auth';
    isRetryable = false;
    userMessage = 'QuickBooks authentication expired. Please reconnect your QuickBooks account.';
  } else if (statusCode === 403) {
    category = 'permission';
    isRetryable = false;
    userMessage = 'QuickBooks permission denied. The app may not have access to this data type.';
  } else if (statusCode === 400) {
    if (message.includes('invalid query') || message.includes('queryparserexception')) {
      category = 'query_syntax';
      userMessage = 'Query format not supported by this QuickBooks company.';
    } else if (message.includes('feature') || message.includes('not enabled') || message.includes('not supported')) {
      category = 'feature_unavailable';
      userMessage = 'This feature is not enabled in the QuickBooks company settings.';
    } else {
      category = 'query_syntax';
      userMessage = 'Unable to query this data from QuickBooks. The company may not use this feature.';
    }
    isRetryable = false;
  } else if (statusCode === 500 || statusCode === 502 || statusCode === 503 || statusCode === 504) {
    category = 'network';
    isRetryable = true;
    userMessage = 'QuickBooks service temporarily unavailable. Please try again.';
  } else if (message.includes('econnrefused') || message.includes('etimedout') || message.includes('network')) {
    category = 'network';
    isRetryable = true;
    userMessage = 'Network error connecting to QuickBooks. Please try again.';
  } else if (stringCode === 'econnrefused' || stringCode === 'etimedout' || stringCode === 'enotfound' || stringCode === 'econnreset') {
    category = 'network';
    isRetryable = true;
    userMessage = 'Network error connecting to QuickBooks. Please try again.';
  } else if (stringCode.includes('auth') || stringCode.includes('token') || stringCode.includes('unauthorized')) {
    category = 'auth';
    isRetryable = false;
    userMessage = 'QuickBooks authentication expired. Please reconnect your QuickBooks account.';
  } else if (stringCode.includes('permission') || stringCode.includes('forbidden') || stringCode.includes('access')) {
    category = 'permission';
    isRetryable = false;
    userMessage = 'QuickBooks permission denied. The app may not have access to this data type.';
  }
  
  const qcError = new Error(rawMessage) as QcApiError;
  qcError.statusCode = statusCode;
  qcError.category = category;
  qcError.isRetryable = isRetryable;
  qcError.userMessage = userMessage;
  
  return qcError;
}

class ApiCallTracker {
  private callCount = 0;
  private callTimestamps: number[] = [];
  private readonly maxCallsPerMinute = 500;
  private readonly minDelayBetweenCalls = 100;
  private requestQueue: Promise<void> = Promise.resolve();
  
  async trackCall(): Promise<void> {
    return new Promise((resolve) => {
      this.requestQueue = this.requestQueue.then(async () => {
        this.callCount++;
        const now = Date.now();
        this.callTimestamps.push(now);
        
        const oneMinuteAgo = now - 60000;
        this.callTimestamps = this.callTimestamps.filter(ts => ts > oneMinuteAgo);
        
        if (this.callTimestamps.length >= this.maxCallsPerMinute) {
          const oldestInWindow = this.callTimestamps[0];
          const waitTime = 60000 - (now - oldestInWindow) + 1000;
          if (waitTime > 0) {
            console.log(`[QC] Rate limit approaching, waiting ${waitTime}ms`);
            await this.delay(waitTime);
          }
        }
        
        await this.delay(this.minDelayBetweenCalls);
        resolve();
      });
    });
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  getCallCount(): number {
    return this.callCount;
  }
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 250
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const classifiedError = classifyApiError(error);
      
      if (!classifiedError.isRetryable || attempt === maxRetries) {
        throw classifiedError;
      }
      
      const jitter = Math.random() * 100;
      const delay = baseDelayMs * Math.pow(2, attempt) + jitter;
      console.log(`[QC] Retry attempt ${attempt + 1}/${maxRetries} after ${delay.toFixed(0)}ms (${classifiedError.category})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

async function ensureValidToken(connection: QboConnection): Promise<{ accessToken: string; connection: QboConnection }> {
  const { accessToken, refreshToken } = decryptTokens(
    connection.accessTokenEncrypted,
    connection.refreshTokenEncrypted
  );
  
  if (connection.accessTokenExpiresAt && !isAccessTokenExpired(new Date(connection.accessTokenExpiresAt))) {
    return { accessToken, connection };
  }
  
  console.log(`[QC] Refreshing expired token for connection ${connection.id}`);
  const tokens = await refreshAccessToken(refreshToken);
  const encrypted = encryptTokens(tokens.access_token, tokens.refresh_token);
  const expiry = calculateTokenExpiry(tokens.expires_in, tokens.x_refresh_token_expires_in);
  
  const updatedConnection = await storage.updateQboConnection(connection.id, {
    accessTokenEncrypted: encrypted.accessTokenEncrypted,
    refreshTokenEncrypted: encrypted.refreshTokenEncrypted,
    accessTokenExpiresAt: expiry.accessTokenExpiresAt,
    refreshTokenExpiresAt: expiry.refreshTokenExpiresAt,
  });
  
  return { accessToken: tokens.access_token, connection: updatedConnection! };
}

async function qboQuery<T>(
  context: QcCheckContext,
  query: string,
  entityName: string
): Promise<T[]> {
  return withRetry(async () => {
    await context.apiCallTracker.trackCall();
    
    const encodedQuery = encodeURIComponent(query);
    const result = await makeQboApiRequest<{ QueryResponse: Record<string, T[]> }>(
      context.accessToken,
      context.realmId,
      `/query?query=${encodedQuery}`
    );
    
    return result.QueryResponse[entityName] || [];
  });
}

async function qboGetEntity<T>(
  context: QcCheckContext,
  entityType: string,
  entityId: string
): Promise<T> {
  return withRetry(async () => {
    await context.apiCallTracker.trackCall();
    
    return makeQboApiRequest<T>(
      context.accessToken,
      context.realmId,
      `/${entityType}/${entityId}`
    );
  });
}

function createBlockedResult(
  code: string,
  name: string,
  section: QcSection,
  error: any
): QcCheckResult {
  const classifiedError = error.category ? error : classifyApiError(error);
  
  return {
    checkCode: code,
    checkName: name,
    section,
    status: 'blocked',
    summary: classifiedError.userMessage,
    errorCategory: classifiedError.category,
    errorDetails: classifiedError.message,
  };
}

export const qcChecks: QcCheck[] = [];

const A1_PeriodLock: QcCheck = {
  code: 'A1',
  name: 'Period Lock Status',
  section: 'period_control',
  description: 'Verifies that the accounting period is properly closed/locked',
  async execute(context) {
    try {
      const preferences = await qboGetEntity<{ Preferences: { AccountingInfoPrefs?: { BookCloseDate?: string } } }>(
        context,
        'preferences',
        ''
      );
      
      const bookCloseDate = preferences?.Preferences?.AccountingInfoPrefs?.BookCloseDate;
      const periodEndStr = context.periodEnd.toISOString().split('T')[0];
      
      if (!bookCloseDate) {
        return {
          checkCode: 'A1',
          checkName: 'Period Lock Status',
          section: 'period_control',
          status: 'warning',
          value: 'No close date set',
          expected: `Period ${periodEndStr} or later locked`,
          summary: 'No book close date configured. Consider setting one after period review.',
        };
      }
      
      const closeDate = new Date(bookCloseDate);
      const periodEnd = context.periodEnd;
      
      if (closeDate >= periodEnd) {
        return {
          checkCode: 'A1',
          checkName: 'Period Lock Status',
          section: 'period_control',
          status: 'pass',
          value: bookCloseDate,
          expected: `Period ${periodEndStr} or later locked`,
          summary: 'Period is properly closed.',
        };
      }
      
      return {
        checkCode: 'A1',
        checkName: 'Period Lock Status',
        section: 'period_control',
        status: 'warning',
        value: bookCloseDate,
        expected: `Period ${periodEndStr} or later locked`,
        summary: `Book close date (${bookCloseDate}) is before selected period end. Period remains open for editing.`,
      };
    } catch (error) {
      return createBlockedResult('A1', 'Period Lock Status', 'period_control', error);
    }
  },
};

const A2_BackdatedEntries: QcCheck = {
  code: 'A2',
  name: 'Backdated Entries',
  section: 'period_control',
  description: 'Identifies transactions created/modified after period end but dated within period',
  async execute(context) {
    try {
      const periodStartStr = context.periodStart.toISOString().split('T')[0];
      const periodEndStr = context.periodEnd.toISOString().split('T')[0];
      const reviewDate = new Date(context.periodEnd);
      reviewDate.setDate(reviewDate.getDate() + 1);
      const reviewDateStr = reviewDate.toISOString().split('T')[0];
      
      const queries = [
        `SELECT * FROM Invoice WHERE TxnDate >= '${periodStartStr}' AND TxnDate <= '${periodEndStr}' AND MetaData.LastUpdatedTime >= '${reviewDateStr}' MAXRESULTS 200`,
        `SELECT * FROM Bill WHERE TxnDate >= '${periodStartStr}' AND TxnDate <= '${periodEndStr}' AND MetaData.LastUpdatedTime >= '${reviewDateStr}' MAXRESULTS 200`,
        `SELECT * FROM JournalEntry WHERE TxnDate >= '${periodStartStr}' AND TxnDate <= '${periodEndStr}' AND MetaData.LastUpdatedTime >= '${reviewDateStr}' MAXRESULTS 200`,
        `SELECT * FROM Deposit WHERE TxnDate >= '${periodStartStr}' AND TxnDate <= '${periodEndStr}' AND MetaData.LastUpdatedTime >= '${reviewDateStr}' MAXRESULTS 200`,
      ];
      
      const [invoices, bills, journals, deposits] = await Promise.all([
        qboQuery<{ Id: string; DocNumber?: string; TxnDate: string; TotalAmt: number; MetaData: { LastUpdatedTime: string } }>(context, queries[0], 'Invoice'),
        qboQuery<{ Id: string; DocNumber?: string; TxnDate: string; TotalAmt: number; MetaData: { LastUpdatedTime: string }; VendorRef?: { name: string } }>(context, queries[1], 'Bill'),
        qboQuery<{ Id: string; DocNumber?: string; TxnDate: string; TotalAmt: number; MetaData: { LastUpdatedTime: string } }>(context, queries[2], 'JournalEntry'),
        qboQuery<{ Id: string; TxnDate: string; TotalAmt: number; MetaData: { LastUpdatedTime: string } }>(context, queries[3], 'Deposit'),
      ]);
      
      const items: QcResultItemData[] = [];
      
      invoices.forEach(inv => {
        items.push({
          externalId: inv.Id,
          externalType: 'Invoice',
          label: `Invoice ${inv.DocNumber || inv.Id}`,
          description: `Modified ${inv.MetaData.LastUpdatedTime} after period close`,
          amount: inv.TotalAmt,
          txnDate: new Date(inv.TxnDate),
          metadata: { lastUpdated: inv.MetaData.LastUpdatedTime },
        });
      });
      
      bills.forEach(bill => {
        items.push({
          externalId: bill.Id,
          externalType: 'Bill',
          label: `Bill ${bill.DocNumber || bill.Id}${bill.VendorRef ? ` - ${bill.VendorRef.name}` : ''}`,
          description: `Modified ${bill.MetaData.LastUpdatedTime} after period close`,
          amount: bill.TotalAmt,
          txnDate: new Date(bill.TxnDate),
          metadata: { lastUpdated: bill.MetaData.LastUpdatedTime },
        });
      });
      
      journals.forEach(je => {
        items.push({
          externalId: je.Id,
          externalType: 'JournalEntry',
          label: `Journal ${je.DocNumber || je.Id}`,
          description: `Modified ${je.MetaData.LastUpdatedTime} after period close`,
          amount: je.TotalAmt,
          txnDate: new Date(je.TxnDate),
          metadata: { lastUpdated: je.MetaData.LastUpdatedTime },
        });
      });
      
      deposits.forEach(dep => {
        items.push({
          externalId: dep.Id,
          externalType: 'Deposit',
          label: `Deposit ${dep.Id}`,
          description: `Modified ${dep.MetaData.LastUpdatedTime} after period close`,
          amount: dep.TotalAmt,
          txnDate: new Date(dep.TxnDate),
          metadata: { lastUpdated: dep.MetaData.LastUpdatedTime },
        });
      });
      
      if (items.length === 0) {
        return {
          checkCode: 'A2',
          checkName: 'Backdated Entries',
          section: 'period_control',
          status: 'pass',
          value: '0 entries',
          expected: 'No backdated entries',
          summary: 'No transactions were modified after period end.',
        };
      }
      
      return {
        checkCode: 'A2',
        checkName: 'Backdated Entries',
        section: 'period_control',
        status: items.length > 5 ? 'fail' : 'warning',
        value: `${items.length} entries`,
        expected: 'No backdated entries',
        summary: `${items.length} transaction(s) were modified after the period end date. Review for appropriateness.`,
        items,
      };
    } catch (error) {
      return createBlockedResult('A2', 'Backdated Entries', 'period_control', error);
    }
  },
};

const A3_FutureDatedEntries: QcCheck = {
  code: 'A3',
  name: 'Future-Dated Entries',
  section: 'period_control',
  description: 'Identifies transactions dated after the selected period',
  async execute(context) {
    try {
      const futureStartStr = new Date(context.periodEnd.getTime() + 86400000).toISOString().split('T')[0];
      const futureEndStr = new Date(context.periodEnd.getTime() + 365 * 86400000).toISOString().split('T')[0];
      
      const queries = [
        `SELECT * FROM Invoice WHERE TxnDate > '${context.periodEnd.toISOString().split('T')[0]}' AND TxnDate <= '${futureEndStr}' MAXRESULTS 100`,
        `SELECT * FROM Bill WHERE TxnDate > '${context.periodEnd.toISOString().split('T')[0]}' AND TxnDate <= '${futureEndStr}' MAXRESULTS 100`,
        `SELECT * FROM JournalEntry WHERE TxnDate > '${context.periodEnd.toISOString().split('T')[0]}' AND TxnDate <= '${futureEndStr}' MAXRESULTS 100`,
      ];
      
      const [invoices, bills, journals] = await Promise.all([
        qboQuery<{ Id: string; DocNumber?: string; TxnDate: string; TotalAmt: number }>(context, queries[0], 'Invoice'),
        qboQuery<{ Id: string; DocNumber?: string; TxnDate: string; TotalAmt: number; VendorRef?: { name: string } }>(context, queries[1], 'Bill'),
        qboQuery<{ Id: string; DocNumber?: string; TxnDate: string; TotalAmt: number }>(context, queries[2], 'JournalEntry'),
      ]);
      
      const items: QcResultItemData[] = [];
      
      invoices.forEach(inv => {
        items.push({
          externalId: inv.Id,
          externalType: 'Invoice',
          label: `Invoice ${inv.DocNumber || inv.Id}`,
          description: `Dated ${inv.TxnDate} - after period end`,
          amount: inv.TotalAmt,
          txnDate: new Date(inv.TxnDate),
        });
      });
      
      bills.forEach(bill => {
        items.push({
          externalId: bill.Id,
          externalType: 'Bill',
          label: `Bill ${bill.DocNumber || bill.Id}${bill.VendorRef ? ` - ${bill.VendorRef.name}` : ''}`,
          description: `Dated ${bill.TxnDate} - after period end`,
          amount: bill.TotalAmt,
          txnDate: new Date(bill.TxnDate),
        });
      });
      
      journals.forEach(je => {
        items.push({
          externalId: je.Id,
          externalType: 'JournalEntry',
          label: `Journal ${je.DocNumber || je.Id}`,
          description: `Dated ${je.TxnDate} - after period end`,
          amount: je.TotalAmt,
          txnDate: new Date(je.TxnDate),
        });
      });
      
      if (items.length === 0) {
        return {
          checkCode: 'A3',
          checkName: 'Future-Dated Entries',
          section: 'period_control',
          status: 'pass',
          value: '0 entries',
          expected: 'No future-dated entries',
          summary: 'No future-dated transactions found.',
        };
      }
      
      return {
        checkCode: 'A3',
        checkName: 'Future-Dated Entries',
        section: 'period_control',
        status: 'warning',
        value: `${items.length} entries`,
        expected: 'No future-dated entries',
        summary: `${items.length} transaction(s) are dated after the period end. These may be intentional advance entries.`,
        items,
      };
    } catch (error) {
      return createBlockedResult('A3', 'Future-Dated Entries', 'period_control', error);
    }
  },
};

const B3_UnreconciledCash: QcCheck = {
  code: 'B3',
  name: 'Unreconciled Cash Transactions',
  section: 'bank_cash',
  description: 'Identifies bank/cash transactions not yet reconciled',
  async execute(context) {
    try {
      const periodEndStr = context.periodEnd.toISOString().split('T')[0];
      
      const accounts = await qboQuery<{ Id: string; Name: string; AccountType: string; CurrentBalance: number }>(
        context,
        `SELECT * FROM Account WHERE AccountType IN ('Bank', 'Other Current Asset') AND Active = true`,
        'Account'
      );
      
      const bankAccounts = accounts.filter(a => a.AccountType === 'Bank' || a.Name.toLowerCase().includes('cash'));
      
      const items: QcResultItemData[] = [];
      let totalUnreconciled = 0;
      
      for (const account of bankAccounts.slice(0, 5)) {
        try {
          const deposits = await qboQuery<{ Id: string; TxnDate: string; TotalAmt: number; DepositToAccountRef?: { value: string } }>(
            context,
            `SELECT * FROM Deposit WHERE TxnDate <= '${periodEndStr}' MAXRESULTS 500`,
            'Deposit'
          );
          
          const relevantDeposits = deposits.filter(d => 
            d.DepositToAccountRef?.value === account.Id
          );
          
          items.push({
            externalId: account.Id,
            externalType: 'Account',
            label: account.Name,
            description: `${relevantDeposits.length} deposits to review`,
            amount: account.CurrentBalance,
            metadata: { accountType: account.AccountType, depositCount: relevantDeposits.length },
          });
          
          totalUnreconciled += account.CurrentBalance;
        } catch {
          items.push({
            externalId: account.Id,
            externalType: 'Account',
            label: account.Name,
            description: 'Could not fetch transactions',
            amount: account.CurrentBalance,
            metadata: { accountType: account.AccountType },
          });
        }
      }
      
      return {
        checkCode: 'B3',
        checkName: 'Unreconciled Cash Transactions',
        section: 'bank_cash',
        status: items.length > 0 ? 'warning' : 'pass',
        value: `${bankAccounts.length} bank accounts`,
        expected: 'All transactions reconciled',
        summary: `Found ${bankAccounts.length} bank/cash accounts. Review reconciliation status in QuickBooks.`,
        items,
        metadata: { totalBankBalance: totalUnreconciled },
      };
    } catch (error) {
      return createBlockedResult('B3', 'Unreconciled Cash Transactions', 'bank_cash', error);
    }
  },
};

const B4_UndepositedFunds: QcCheck = {
  code: 'B4',
  name: 'Undeposited Funds Balance',
  section: 'bank_cash',
  description: 'Checks for payments sitting in undeposited funds',
  async execute(context) {
    try {
      const accounts = await qboQuery<{ Id: string; Name: string; AccountType: string; CurrentBalance: number; AccountSubType?: string }>(
        context,
        `SELECT * FROM Account WHERE AccountType = 'Other Current Asset' AND Active = true`,
        'Account'
      );
      
      const undepositedFunds = accounts.find(a => 
        a.Name.toLowerCase().includes('undeposited') || 
        a.AccountSubType === 'UndepositedFunds'
      );
      
      if (!undepositedFunds) {
        return {
          checkCode: 'B4',
          checkName: 'Undeposited Funds Balance',
          section: 'bank_cash',
          status: 'pass',
          value: 'No account found',
          expected: '$0 balance',
          summary: 'No undeposited funds account found or balance is zero.',
        };
      }
      
      const balance = undepositedFunds.CurrentBalance;
      
      if (Math.abs(balance) < 0.01) {
        return {
          checkCode: 'B4',
          checkName: 'Undeposited Funds Balance',
          section: 'bank_cash',
          status: 'pass',
          value: '$0.00',
          expected: '$0 balance',
          summary: 'Undeposited funds account has zero balance.',
        };
      }
      
      const periodEndStr = context.periodEnd.toISOString().split('T')[0];
      const payments = await qboQuery<{ Id: string; TxnDate: string; TotalAmt: number; CustomerRef?: { name: string }; PaymentMethodRef?: { name: string } }>(
        context,
        `SELECT * FROM Payment WHERE TxnDate <= '${periodEndStr}' AND DepositToAccountRef = '${undepositedFunds.Id}' MAXRESULTS 200`,
        'Payment'
      );
      
      const items: QcResultItemData[] = payments.map(pmt => ({
        externalId: pmt.Id,
        externalType: 'Payment',
        label: `Payment from ${pmt.CustomerRef?.name || 'Unknown'}`,
        description: `${pmt.PaymentMethodRef?.name || 'Unknown method'} - ${pmt.TxnDate}`,
        amount: pmt.TotalAmt,
        txnDate: new Date(pmt.TxnDate),
      }));
      
      if (items.length === 0) {
        items.push({
          externalId: undepositedFunds.Id,
          externalType: 'Account',
          label: 'Undeposited Funds',
          description: 'Balance from prior periods or other transactions',
          amount: balance,
        });
      }
      
      const status: QcStatus = balance > 5000 ? 'fail' : balance > 500 ? 'warning' : 'pass';
      
      return {
        checkCode: 'B4',
        checkName: 'Undeposited Funds Balance',
        section: 'bank_cash',
        status,
        value: `$${balance.toFixed(2)}`,
        expected: '$0 balance',
        summary: `Undeposited funds has a balance of $${balance.toFixed(2)}. These payments should be deposited.`,
        items,
        metadata: { accountId: undepositedFunds.Id },
      };
    } catch (error) {
      return createBlockedResult('B4', 'Undeposited Funds Balance', 'bank_cash', error);
    }
  },
};

const C1_InvoiceSequencing: QcCheck = {
  code: 'C1',
  name: 'Invoice Number Sequencing',
  section: 'sales_ar',
  description: 'Checks for gaps or duplicates in invoice numbering',
  async execute(context) {
    try {
      const periodStartStr = context.periodStart.toISOString().split('T')[0];
      const periodEndStr = context.periodEnd.toISOString().split('T')[0];
      
      const invoices = await qboQuery<{ Id: string; DocNumber: string; TxnDate: string; TotalAmt: number; CustomerRef?: { name: string } }>(
        context,
        `SELECT * FROM Invoice WHERE TxnDate >= '${periodStartStr}' AND TxnDate <= '${periodEndStr}' ORDER BY DocNumber MAXRESULTS 1000`,
        'Invoice'
      );
      
      if (invoices.length < 2) {
        return {
          checkCode: 'C1',
          checkName: 'Invoice Number Sequencing',
          section: 'sales_ar',
          status: 'pass',
          value: `${invoices.length} invoices`,
          expected: 'Sequential numbering',
          summary: 'Not enough invoices to check sequencing.',
        };
      }
      
      const numericInvoices = invoices
        .filter(inv => inv.DocNumber && /^\d+$/.test(inv.DocNumber.replace(/[^0-9]/g, '')))
        .map(inv => ({
          ...inv,
          numericPart: parseInt(inv.DocNumber.replace(/[^0-9]/g, ''), 10),
        }))
        .sort((a, b) => a.numericPart - b.numericPart);
      
      const gaps: QcResultItemData[] = [];
      const duplicates: QcResultItemData[] = [];
      
      for (let i = 1; i < numericInvoices.length; i++) {
        const prev = numericInvoices[i - 1];
        const curr = numericInvoices[i];
        
        if (curr.numericPart === prev.numericPart) {
          duplicates.push({
            externalId: curr.Id,
            externalType: 'Invoice',
            label: `Invoice ${curr.DocNumber}`,
            description: `Duplicate number - also used by invoice ${prev.Id}`,
            amount: curr.TotalAmt,
            txnDate: new Date(curr.TxnDate),
            metadata: { duplicateOf: prev.Id },
          });
        } else if (curr.numericPart - prev.numericPart > 1) {
          gaps.push({
            externalId: prev.Id,
            externalType: 'Invoice',
            label: `Gap after ${prev.DocNumber}`,
            description: `Missing numbers ${prev.numericPart + 1} to ${curr.numericPart - 1}`,
            amount: 0,
            metadata: { gapStart: prev.numericPart + 1, gapEnd: curr.numericPart - 1, gapSize: curr.numericPart - prev.numericPart - 1 },
          });
        }
      }
      
      const items = [...duplicates, ...gaps];
      
      if (items.length === 0) {
        return {
          checkCode: 'C1',
          checkName: 'Invoice Number Sequencing',
          section: 'sales_ar',
          status: 'pass',
          value: `${invoices.length} invoices`,
          expected: 'Sequential numbering',
          summary: 'Invoice numbers are sequential with no gaps or duplicates.',
        };
      }
      
      const status: QcStatus = duplicates.length > 0 ? 'fail' : 'warning';
      
      return {
        checkCode: 'C1',
        checkName: 'Invoice Number Sequencing',
        section: 'sales_ar',
        status,
        value: `${gaps.length} gaps, ${duplicates.length} duplicates`,
        expected: 'Sequential numbering',
        summary: `Found ${gaps.length} numbering gap(s) and ${duplicates.length} duplicate number(s).`,
        items,
        metadata: { totalInvoices: invoices.length, numericInvoices: numericInvoices.length },
      };
    } catch (error) {
      return createBlockedResult('C1', 'Invoice Number Sequencing', 'sales_ar', error);
    }
  },
};

const C2_ARAgeing: QcCheck = {
  code: 'C2',
  name: 'Accounts Receivable Ageing',
  section: 'sales_ar',
  description: 'Analyzes aged receivables and identifies overdue amounts',
  async execute(context) {
    try {
      const invoices = await qboQuery<{ 
        Id: string; 
        DocNumber: string; 
        TxnDate: string; 
        DueDate?: string;
        TotalAmt: number; 
        Balance: number;
        CustomerRef?: { name: string; value: string };
      }>(
        context,
        `SELECT * FROM Invoice WHERE Balance > 0 MAXRESULTS 500`,
        'Invoice'
      );
      
      if (invoices.length === 0) {
        return {
          checkCode: 'C2',
          checkName: 'Accounts Receivable Ageing',
          section: 'sales_ar',
          status: 'pass',
          value: '$0 outstanding',
          expected: 'Low overdue balances',
          summary: 'No outstanding invoices.',
        };
      }
      
      const periodEnd = context.periodEnd;
      const ageBuckets = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
      const items: QcResultItemData[] = [];
      
      invoices.forEach(inv => {
        const dueDate = inv.DueDate ? new Date(inv.DueDate) : new Date(inv.TxnDate);
        const daysOverdue = Math.floor((periodEnd.getTime() - dueDate.getTime()) / 86400000);
        
        if (daysOverdue <= 0) {
          ageBuckets.current += inv.Balance;
        } else if (daysOverdue <= 30) {
          ageBuckets.days30 += inv.Balance;
        } else if (daysOverdue <= 60) {
          ageBuckets.days60 += inv.Balance;
        } else if (daysOverdue <= 90) {
          ageBuckets.days90 += inv.Balance;
        } else {
          ageBuckets.over90 += inv.Balance;
          items.push({
            externalId: inv.Id,
            externalType: 'Invoice',
            label: `Invoice ${inv.DocNumber || inv.Id} - ${inv.CustomerRef?.name || 'Unknown'}`,
            description: `${daysOverdue} days overdue`,
            amount: inv.Balance,
            txnDate: new Date(inv.TxnDate),
            metadata: { daysOverdue, customerId: inv.CustomerRef?.value },
          });
        }
      });
      
      const totalOverdue = ageBuckets.days30 + ageBuckets.days60 + ageBuckets.days90 + ageBuckets.over90;
      const totalOutstanding = ageBuckets.current + totalOverdue;
      
      let status: QcStatus = 'pass';
      if (ageBuckets.over90 > 0) status = 'fail';
      else if (ageBuckets.days60 > 0 || ageBuckets.days90 > 0) status = 'warning';
      
      return {
        checkCode: 'C2',
        checkName: 'Accounts Receivable Ageing',
        section: 'sales_ar',
        status,
        value: `$${totalOutstanding.toFixed(2)} total ($${totalOverdue.toFixed(2)} overdue)`,
        expected: 'Low overdue balances',
        summary: `Total AR: $${totalOutstanding.toFixed(2)}. Over 90 days: $${ageBuckets.over90.toFixed(2)}`,
        items: items.slice(0, 50),
        metadata: { ageBuckets, invoiceCount: invoices.length },
      };
    } catch (error) {
      return createBlockedResult('C2', 'Accounts Receivable Ageing', 'sales_ar', error);
    }
  },
};

const D2_APAgeing: QcCheck = {
  code: 'D2',
  name: 'Accounts Payable Ageing',
  section: 'purchases_ap',
  description: 'Analyzes aged payables and identifies overdue amounts',
  async execute(context) {
    try {
      const bills = await qboQuery<{ 
        Id: string; 
        DocNumber?: string; 
        TxnDate: string; 
        DueDate?: string;
        TotalAmt: number; 
        Balance: number;
        VendorRef?: { name: string; value: string };
      }>(
        context,
        `SELECT * FROM Bill WHERE Balance > 0 MAXRESULTS 500`,
        'Bill'
      );
      
      if (bills.length === 0) {
        return {
          checkCode: 'D2',
          checkName: 'Accounts Payable Ageing',
          section: 'purchases_ap',
          status: 'pass',
          value: '$0 outstanding',
          expected: 'Low overdue balances',
          summary: 'No outstanding bills.',
        };
      }
      
      const periodEnd = context.periodEnd;
      const ageBuckets = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
      const items: QcResultItemData[] = [];
      
      bills.forEach(bill => {
        const dueDate = bill.DueDate ? new Date(bill.DueDate) : new Date(bill.TxnDate);
        const daysOverdue = Math.floor((periodEnd.getTime() - dueDate.getTime()) / 86400000);
        
        if (daysOverdue <= 0) {
          ageBuckets.current += bill.Balance;
        } else if (daysOverdue <= 30) {
          ageBuckets.days30 += bill.Balance;
        } else if (daysOverdue <= 60) {
          ageBuckets.days60 += bill.Balance;
        } else if (daysOverdue <= 90) {
          ageBuckets.days90 += bill.Balance;
        } else {
          ageBuckets.over90 += bill.Balance;
          items.push({
            externalId: bill.Id,
            externalType: 'Bill',
            label: `Bill ${bill.DocNumber || bill.Id} - ${bill.VendorRef?.name || 'Unknown'}`,
            description: `${daysOverdue} days overdue`,
            amount: bill.Balance,
            txnDate: new Date(bill.TxnDate),
            metadata: { daysOverdue, vendorId: bill.VendorRef?.value },
          });
        }
      });
      
      const totalOverdue = ageBuckets.days30 + ageBuckets.days60 + ageBuckets.days90 + ageBuckets.over90;
      const totalOutstanding = ageBuckets.current + totalOverdue;
      
      let status: QcStatus = 'pass';
      if (ageBuckets.over90 > 0) status = 'fail';
      else if (ageBuckets.days60 > 0 || ageBuckets.days90 > 0) status = 'warning';
      
      return {
        checkCode: 'D2',
        checkName: 'Accounts Payable Ageing',
        section: 'purchases_ap',
        status,
        value: `$${totalOutstanding.toFixed(2)} total ($${totalOverdue.toFixed(2)} overdue)`,
        expected: 'Low overdue balances',
        summary: `Total AP: $${totalOutstanding.toFixed(2)}. Over 90 days: $${ageBuckets.over90.toFixed(2)}`,
        items: items.slice(0, 50),
        metadata: { ageBuckets, billCount: bills.length },
      };
    } catch (error) {
      return createBlockedResult('D2', 'Accounts Payable Ageing', 'purchases_ap', error);
    }
  },
};

const E1_VATCompliance: QcCheck = {
  code: 'E1',
  name: 'VAT/GST Compliance',
  section: 'vat',
  description: 'Checks for transactions missing tax codes',
  async execute(context) {
    try {
      const periodStartStr = context.periodStart.toISOString().split('T')[0];
      const periodEndStr = context.periodEnd.toISOString().split('T')[0];
      
      const [invoices, bills] = await Promise.all([
        qboQuery<{ Id: string; DocNumber?: string; TxnDate: string; TotalAmt: number; TxnTaxDetail?: { TotalTax: number }; Line: Array<{ SalesItemLineDetail?: { TaxCodeRef?: { value: string } } }> }>(
          context,
          `SELECT * FROM Invoice WHERE TxnDate >= '${periodStartStr}' AND TxnDate <= '${periodEndStr}' MAXRESULTS 500`,
          'Invoice'
        ),
        qboQuery<{ Id: string; DocNumber?: string; TxnDate: string; TotalAmt: number; TxnTaxDetail?: { TotalTax: number }; Line: Array<{ ItemBasedExpenseLineDetail?: { TaxCodeRef?: { value: string } } }> }>(
          context,
          `SELECT * FROM Bill WHERE TxnDate >= '${periodStartStr}' AND TxnDate <= '${periodEndStr}' MAXRESULTS 500`,
          'Bill'
        ),
      ]);
      
      const items: QcResultItemData[] = [];
      
      invoices.forEach(inv => {
        const hasNoTax = !inv.TxnTaxDetail || inv.TxnTaxDetail.TotalTax === 0;
        const missingTaxCodes = inv.Line?.some(line => 
          line.SalesItemLineDetail && !line.SalesItemLineDetail.TaxCodeRef
        );
        
        if (hasNoTax || missingTaxCodes) {
          items.push({
            externalId: inv.Id,
            externalType: 'Invoice',
            label: `Invoice ${inv.DocNumber || inv.Id}`,
            description: hasNoTax ? 'No tax charged' : 'Missing tax code on line items',
            amount: inv.TotalAmt,
            txnDate: new Date(inv.TxnDate),
            metadata: { taxAmount: inv.TxnTaxDetail?.TotalTax || 0 },
          });
        }
      });
      
      bills.forEach(bill => {
        const hasNoTax = !bill.TxnTaxDetail || bill.TxnTaxDetail.TotalTax === 0;
        
        if (hasNoTax) {
          items.push({
            externalId: bill.Id,
            externalType: 'Bill',
            label: `Bill ${bill.DocNumber || bill.Id}`,
            description: 'No tax recorded',
            amount: bill.TotalAmt,
            txnDate: new Date(bill.TxnDate),
            metadata: { taxAmount: bill.TxnTaxDetail?.TotalTax || 0 },
          });
        }
      });
      
      if (items.length === 0) {
        return {
          checkCode: 'E1',
          checkName: 'VAT/GST Compliance',
          section: 'vat',
          status: 'pass',
          value: 'All transactions have tax codes',
          expected: 'Tax codes on all taxable transactions',
          summary: 'All invoices and bills have proper tax coding.',
        };
      }
      
      const noTaxItems = items.filter(i => i.description?.includes('No tax'));
      const missingCodeItems = items.filter(i => i.description?.includes('Missing'));
      
      return {
        checkCode: 'E1',
        checkName: 'VAT/GST Compliance',
        section: 'vat',
        status: items.length > 10 ? 'fail' : 'warning',
        value: `${items.length} items need review`,
        expected: 'Tax codes on all taxable transactions',
        summary: `${noTaxItems.length} transaction(s) with no tax, ${missingCodeItems.length} missing tax codes.`,
        items: items.slice(0, 100),
        metadata: { totalInvoices: invoices.length, totalBills: bills.length },
      };
    } catch (error) {
      return createBlockedResult('E1', 'VAT/GST Compliance', 'vat', error);
    }
  },
};

const F1_UnbalancedJournals: QcCheck = {
  code: 'F1',
  name: 'Journal Entry Balance',
  section: 'journals',
  description: 'Verifies all journal entries are balanced',
  async execute(context) {
    try {
      const periodStartStr = context.periodStart.toISOString().split('T')[0];
      const periodEndStr = context.periodEnd.toISOString().split('T')[0];
      
      const journals = await qboQuery<{ 
        Id: string; 
        DocNumber?: string; 
        TxnDate: string;
        Line: Array<{ 
          Amount: number; 
          JournalEntryLineDetail?: { PostingType: 'Debit' | 'Credit' }
        }>;
      }>(
        context,
        `SELECT * FROM JournalEntry WHERE TxnDate >= '${periodStartStr}' AND TxnDate <= '${periodEndStr}' MAXRESULTS 500`,
        'JournalEntry'
      );
      
      const items: QcResultItemData[] = [];
      
      journals.forEach(je => {
        let debits = 0;
        let credits = 0;
        
        je.Line?.forEach(line => {
          if (line.JournalEntryLineDetail?.PostingType === 'Debit') {
            debits += line.Amount;
          } else if (line.JournalEntryLineDetail?.PostingType === 'Credit') {
            credits += line.Amount;
          }
        });
        
        const diff = Math.abs(debits - credits);
        if (diff > 0.01) {
          items.push({
            externalId: je.Id,
            externalType: 'JournalEntry',
            label: `Journal ${je.DocNumber || je.Id}`,
            description: `Out of balance by $${diff.toFixed(2)} (Dr: $${debits.toFixed(2)}, Cr: $${credits.toFixed(2)})`,
            amount: diff,
            txnDate: new Date(je.TxnDate),
            metadata: { debits, credits, difference: diff },
          });
        }
      });
      
      if (items.length === 0) {
        return {
          checkCode: 'F1',
          checkName: 'Journal Entry Balance',
          section: 'journals',
          status: 'pass',
          value: `${journals.length} journals`,
          expected: 'All entries balanced',
          summary: 'All journal entries are balanced.',
        };
      }
      
      return {
        checkCode: 'F1',
        checkName: 'Journal Entry Balance',
        section: 'journals',
        status: 'fail',
        value: `${items.length} unbalanced`,
        expected: 'All entries balanced',
        summary: `${items.length} journal entry(ies) are not balanced.`,
        items,
        metadata: { totalJournals: journals.length },
      };
    } catch (error) {
      return createBlockedResult('F1', 'Journal Entry Balance', 'journals', error);
    }
  },
};

qcChecks.push(
  A1_PeriodLock,
  A2_BackdatedEntries,
  A3_FutureDatedEntries,
  B3_UnreconciledCash,
  B4_UndepositedFunds,
  C1_InvoiceSequencing,
  C2_ARAgeing,
  D2_APAgeing,
  E1_VATCompliance,
  F1_UnbalancedJournals
);

export async function runQcChecks(
  clientId: string,
  connectionId: string,
  periodStart: Date,
  periodEnd: Date,
  triggeredBy?: string
): Promise<QboQcRun> {
  const connection = await storage.getQboConnectionById(connectionId);
  if (!connection) {
    throw new Error(`Connection ${connectionId} not found`);
  }
  
  if (connection.clientId !== clientId) {
    throw new Error('Connection does not belong to client');
  }
  
  const runData: InsertQboQcRun = {
    clientId,
    connectionId,
    periodStart: periodStart.toISOString().split('T')[0],
    periodEnd: periodEnd.toISOString().split('T')[0],
    status: 'running',
    triggeredBy,
  };
  
  const run = await storage.createQcRun(runData);
  
  try {
    await storage.updateQcRun(run.id, { startedAt: new Date() });
    
    const { accessToken, connection: updatedConnection } = await ensureValidToken(connection);
    
    const apiCallTracker = new ApiCallTracker();
    
    const context: QcCheckContext = {
      accessToken,
      realmId: updatedConnection.realmId,
      periodStart,
      periodEnd,
      connection: updatedConnection,
      apiCallTracker,
    };
    
    const checkResults = await Promise.all(
      qcChecks.map(check => 
        check.execute(context).catch(error => {
          const classified = classifyApiError(error);
          return {
            checkCode: check.code,
            checkName: check.name,
            section: check.section,
            status: 'blocked' as QcStatus,
            summary: classified.userMessage || `Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            errorCategory: classified.category,
            errorDetails: classified.message,
            metadata: {
              errorCategory: classified.category,
              errorDetails: classified.message,
              statusCode: classified.statusCode,
            },
          } as QcCheckResult;
        })
      )
    );
    
    let passed = 0, warnings = 0, failed = 0, blocked = 0;
    
    for (const result of checkResults) {
      const fullResult = result as QcCheckResult;
      const metadata: Record<string, unknown> = {
        ...(fullResult.metadata || {}),
      };
      
      if (fullResult.errorCategory) {
        metadata.errorCategory = fullResult.errorCategory;
      }
      if (fullResult.errorDetails) {
        metadata.errorDetails = fullResult.errorDetails;
      }
      
      const finalMetadata = Object.keys(metadata).length > 0 ? metadata : undefined;
      
      if (result.status === 'blocked') {
        console.log(`[QC Debug] Blocked check ${result.checkCode}: metadata =`, JSON.stringify(finalMetadata));
      }
      
      const resultData: InsertQboQcResult = {
        runId: run.id,
        checkCode: result.checkCode,
        checkName: result.checkName,
        section: result.section,
        status: result.status,
        value: fullResult.value,
        expected: fullResult.expected,
        summary: result.summary,
        metadata: finalMetadata,
        itemCount: fullResult.items ? fullResult.items.length : 0,
      };
      
      const savedResult = await storage.createQcResult(resultData);
      
      if ('items' in result && result.items && result.items.length > 0) {
        for (const item of result.items.slice(0, 100)) {
          const itemData: InsertQboQcResultItem = {
            resultId: savedResult.id,
            externalId: item.externalId,
            externalType: item.externalType,
            label: item.label,
            description: item.description,
            amount: item.amount?.toString(),
            txnDate: item.txnDate?.toISOString().split('T')[0],
            metadata: item.metadata as Record<string, unknown> | undefined,
          };
          
          await storage.createQcResultItem(itemData);
        }
      }
      
      switch (result.status) {
        case 'pass': passed++; break;
        case 'warning': warnings++; break;
        case 'fail': failed++; break;
        case 'blocked': blocked++; break;
      }
    }
    
    const totalChecks = checkResults.length;
    const score = totalChecks > 0 
      ? Math.round(((passed + warnings * 0.5) / totalChecks) * 100)
      : 0;
    
    const completedRun = await storage.updateQcRun(run.id, {
      status: 'completed',
      totalChecks,
      passedChecks: passed,
      warningChecks: warnings,
      failedChecks: failed,
      blockedChecks: blocked,
      score: score.toString(),
      apiCallCount: apiCallTracker.getCallCount(),
      completedAt: new Date(),
    });
    
    return completedRun!;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await storage.updateQcRun(run.id, {
      status: 'failed',
      errorLog: errorMessage,
      completedAt: new Date(),
    });
    
    throw error;
  }
}

export function getSectionLabel(section: QcSection): string {
  const labels: Record<QcSection, string> = {
    period_control: 'Period Control',
    bank_cash: 'Bank & Cash',
    sales_ar: 'Sales & Receivables',
    purchases_ap: 'Purchases & Payables',
    vat: 'VAT/GST Compliance',
    journals: 'Journal Entries',
    attachments: 'Attachments',
    master_data: 'Master Data',
    analytics: 'Analytics',
  };
  return labels[section] || section;
}

export function getStatusColor(status: QcStatus): string {
  const colors: Record<QcStatus, string> = {
    pass: 'green',
    warning: 'amber',
    fail: 'red',
    blocked: 'gray',
  };
  return colors[status] || 'gray';
}

export function getStatusLabel(status: QcStatus): string {
  const labels: Record<QcStatus, string> = {
    pass: 'Pass',
    warning: 'Warning',
    fail: 'Fail',
    blocked: 'Blocked',
  };
  return labels[status] || status;
}
