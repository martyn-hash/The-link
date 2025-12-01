# FutureBooks: Quality Control & Advisory System

## Vision

FutureBooks transforms the delivery of bookkeeping and accountancy services from compliance-focused to value-driven advisory. By leveraging the QuickBooks API, we create an automated quality control system that:

1. **Raises Quality Standards** - Systematic, measurable checks that ensure books are world-class
2. **Improves Client Communication** - Meaningful reports that demonstrate value and insight
3. **Enables Advisory Services** - Data-driven insights that move beyond compliance to guidance

---

## Implementation Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1** | Quality Control Checks | ✅ Core Complete |
| **Phase 2** | Financial Insights & KPIs | ⏳ Future |
| **Phase 3** | AI-Generated Advisory Comments | ⏳ Future |
| **Phase 4** | Beautiful Client Reports | ⏳ Future |

---

## Current Status (December 2025)

### What's Been Built

**Phase 1 - Quality Control Engine** is operational with the following capabilities:

#### 10 QC Checks Implemented

| Check Code | Section | Description | Status |
|------------|---------|-------------|--------|
| `undeposited_funds` | Bank & Cash | Verifies Undeposited Funds account is cleared | ✅ Live |
| `bank_account_count` | Bank & Cash | Confirms at least one bank account exists | ✅ Live |
| `open_invoices_ageing` | Sales/AR | Flags invoices over 90 days old | ✅ Live |
| `negative_ar_balances` | Sales/AR | Detects customers with credit balances | ✅ Live |
| `unpaid_bills_ageing` | Purchases/AP | Flags bills over 90 days old | ✅ Live |
| `negative_ap_balances` | Purchases/AP | Detects vendors with debit balances | ✅ Live |
| `suspense_balance` | Journals | Checks "Ask My Accountant" account is zero | ✅ Live |
| `journal_count` | Journals | Verifies journal entries exist in period | ✅ Live |
| `large_journals` | Journals | Flags unusual journal entries over £5,000 | ✅ Live |
| `new_accounts` | Master Data | Identifies newly created Chart of Accounts | ✅ Live |

#### System Features

- **Period Selection**: Monthly QC runs with configurable date ranges
- **Scoring System**: Weighted formula - ((Passed × 1.0) + (Warnings × 0.5)) / Total × 100
- **Error Classification**: 7 categories (rate_limit, auth, permission, query_syntax, feature_unavailable, network, unknown)
- **Retry Logic**: Exponential backoff for transient API failures (429, 5xx)
- **Rate Limiting**: Request queue with 100ms delays to stay within QuickBooks limits
- **Token Management**: Automatic refresh of expired OAuth tokens

#### Where to Access

QC functionality is currently in the **Super Admin** section for testing:
- Navigate to: **Super Admin → QuickBooks Connections**
- Click on any connected client row to access QC
- URL pattern: `/super-admin/qbo-connections/:connectionId/qc`

#### Database Schema

```
qbo_qc_runs          - QC run metadata (period, status, scores)
qbo_qc_results       - Individual check results with metadata
qbo_qc_result_items  - Flagged transactions for review
qbo_qc_approval_history - Audit trail for approvals
```

### What's Next

**Remaining Phase 1 Work:**
- [ ] Configurable thresholds (let firms customize limits)
- [ ] Reports API checks (Trial Balance, P&L for analytics)
- [ ] Attachable check (verify journal documentation)
- [ ] Duplicate vendor/customer detection

**Phase 2 Preview:**
- Financial KPIs (liquidity ratios, working capital)
- Trend analysis across periods
- Benchmark comparisons

---

## QuickBooks Integration Architecture

### Connection Architecture

The system uses OAuth 2.0 to connect client QuickBooks accounts:

- **Connection Table**: `qbo_connections` links clients to their QuickBooks realm
- **Token Management**: Encrypted access/refresh tokens with automatic refresh
- **Multi-tenant**: Each client has their own isolated connection
- **Admin Control**: Super Admins manage connections via `/super-admin/qbo-connections`

### API Request Pattern

```typescript
import { makeQboApiRequest } from '../services/quickbooks';

// Generic pattern for API calls
const data = await makeQboApiRequest<ResponseType>(
  accessToken,
  realmId,
  '/endpoint?query=params',
  'GET'
);
```

---

## Phase 1: Quality Control Implementation

> **Note:** For detailed pass/warning/fail criteria and thresholds for each check, see `future_docs.md` in the project root.

### Date Filtering Approach

All QC checks operate within a **review period** defined by:

```typescript
interface QCPeriod {
  periodStart: Date;      // First day of the period (e.g., 2024-01-01)
  periodEnd: Date;        // Last day of the period (e.g., 2024-01-31)
  closeDate: Date;        // Books lock date (typically end of previous period)
  priorPeriodEnd: Date;   // End of the previous period for comparisons
}
```

### QuickBooks Query Language (QBO Query)

QBO uses a SQL-like query language via the `/query` endpoint:

```
POST /v3/company/{realmId}/query?minorversion=65
Content-Type: application/text

SELECT * FROM Invoice WHERE TxnDate >= '2024-01-01' AND TxnDate <= '2024-01-31'
```

**Date Format**: `YYYY-MM-DD`

---

## A. Period Control

### A1. Books Locked to Prior Periods

**Check**: `close_date >= end_of_previous_period`

**API Endpoint**: `/v3/company/{realmId}/preferences`

```typescript
interface PreferencesResponse {
  Preferences: {
    AccountingInfoPrefs: {
      BookCloseDate?: string;  // YYYY-MM-DD or null if not set
    };
  };
}
```

**Implementation**:
```typescript
const preferences = await makeQboApiRequest<PreferencesResponse>(
  accessToken, realmId, '/preferences', 'GET'
);

const bookCloseDate = preferences.Preferences.AccountingInfoPrefs.BookCloseDate;
const isPassed = bookCloseDate && new Date(bookCloseDate) >= priorPeriodEnd;

return {
  check: 'Books locked to prior periods',
  status: isPassed ? 'PASS' : 'FAIL',
  value: bookCloseDate || 'Not set',
  expected: `>= ${formatDate(priorPeriodEnd)}`,
};
```

### A2. No Back-Dated Transactions

**Check**: No transactions with `TxnDate < close_date`

**API Query**: Multiple entity types need checking

```sql
SELECT * FROM Invoice WHERE TxnDate < 'CLOSE_DATE' AND MetaData.LastUpdatedTime > 'PERIOD_START'
SELECT * FROM Bill WHERE TxnDate < 'CLOSE_DATE' AND MetaData.LastUpdatedTime > 'PERIOD_START'
SELECT * FROM JournalEntry WHERE TxnDate < 'CLOSE_DATE' AND MetaData.LastUpdatedTime > 'PERIOD_START'
SELECT * FROM Payment WHERE TxnDate < 'CLOSE_DATE' AND MetaData.LastUpdatedTime > 'PERIOD_START'
SELECT * FROM Purchase WHERE TxnDate < 'CLOSE_DATE' AND MetaData.LastUpdatedTime > 'PERIOD_START'
```

**Implementation**:
```typescript
const entities = ['Invoice', 'Bill', 'JournalEntry', 'Payment', 'Purchase', 'SalesReceipt', 'Deposit'];
const backdatedTxns: BackdatedTransaction[] = [];

for (const entity of entities) {
  const query = `SELECT Id, DocNumber, TxnDate FROM ${entity} 
                 WHERE TxnDate < '${closeDate}' 
                 AND MetaData.LastUpdatedTime > '${periodStart}'`;
  
  const response = await makeQboQuery(accessToken, realmId, query);
  if (response.QueryResponse[entity]) {
    backdatedTxns.push(...response.QueryResponse[entity].map(t => ({
      type: entity,
      id: t.Id,
      docNumber: t.DocNumber,
      txnDate: t.TxnDate
    })));
  }
}

return {
  check: 'No back-dated transactions',
  status: backdatedTxns.length === 0 ? 'PASS' : 'FAIL',
  value: `${backdatedTxns.length} found`,
  items: backdatedTxns,
};
```

### A3. No Excessively Future-Dated Transactions

**Check**: No transactions with `TxnDate > period_end + 30 days`

**API Query**:
```sql
SELECT * FROM Invoice WHERE TxnDate > 'CUTOFF_DATE'
```

**Implementation**:
```typescript
const cutoffDate = addDays(periodEnd, 30);

const entities = ['Invoice', 'Bill', 'JournalEntry', 'Payment', 'Purchase'];
const futureTxns: FutureTransaction[] = [];

for (const entity of entities) {
  const query = `SELECT Id, DocNumber, TxnDate FROM ${entity} 
                 WHERE TxnDate > '${formatDate(cutoffDate)}'`;
  
  const response = await makeQboQuery(accessToken, realmId, query);
  // Process similar to backdated...
}
```

---

## B. Bank & Cash

### B1. All Bank Accounts Reconciled to Period End

**Check**: Reconciliation report exists for `period_end` with ending difference = £0

**API Approach**: QBO doesn't expose reconciliation reports directly via API. Use the Reports endpoint:

```typescript
// Get list of bank accounts
const accounts = await makeQboQuery(accessToken, realmId,
  "SELECT Id, Name, CurrentBalance FROM Account WHERE AccountType = 'Bank'"
);

// Get Bank Register report for each account
const report = await makeQboApiRequest(
  accessToken, realmId,
  `/reports/AccountBalances?account=${accountId}&date_macro=This%20Fiscal%20Year`
);
```

**Alternative Approach - Transaction Analysis**:
```typescript
// Check for unreconciled transactions
const unreconciledQuery = `SELECT * FROM Purchase 
  WHERE AccountRef = '${bankAccountId}'
  AND LinkedTxn IS NULL`;
```

**Note**: Full reconciliation status may require checking the `BankDeposit` and `Transfer` entities, or using the Reconciliation report if available in the subscription tier.

### B2. GL Balance Matches Online Bank Balance

**Check**: `|gl_balance – online_feed_balance| <= £1`

**API Notes**: Bank feed balance is not directly exposed in the API. This check requires:
1. Fetching the Account's `CurrentBalance` from the Chart of Accounts
2. Comparing against known bank statement balance (manual or bank feed integration)

```typescript
const accounts = await makeQboQuery(accessToken, realmId,
  "SELECT Id, Name, CurrentBalance FROM Account WHERE AccountType = 'Bank'"
);

for (const account of accounts.QueryResponse.Account) {
  // account.CurrentBalance is the GL balance
  // Bank feed balance would need separate integration or manual input
}
```

### B3. Unreconciled Bank Items Below Threshold

**Check**: `< 3 unreconciled items` OR `< £50 total unreconciled`

**API Query**:
```sql
SELECT * FROM Purchase WHERE AccountRef IN ('bank_account_ids') AND Linked = false
SELECT * FROM Deposit WHERE AccountRef IN ('bank_account_ids') AND Linked = false
```

**Note**: The `Linked` property may vary by transaction type. May need to check for presence of `LinkedTxn` array.

### B4. Undeposited Funds Cleared

**Check**: `Undeposited Funds account balance = £0 ± £5`

**API Query**:
```typescript
// Find the Undeposited Funds account
const accounts = await makeQboQuery(accessToken, realmId,
  "SELECT Id, Name, CurrentBalance FROM Account WHERE Name LIKE '%Undeposited%'"
);

// Or by account type
const accounts = await makeQboQuery(accessToken, realmId,
  "SELECT Id, Name, CurrentBalance FROM Account WHERE AccountSubType = 'UndepositedFunds'"
);

const undepositedBalance = accounts.QueryResponse.Account[0]?.CurrentBalance || 0;
const isPassed = Math.abs(undepositedBalance) <= 5;
```

---

## C. Sales & Accounts Receivable

### C1. No Missing Invoice Numbers or Gaps

**Check**: Invoice numbers sequential, or gaps flagged for approval

**API Query**:
```sql
SELECT DocNumber, TxnDate FROM Invoice WHERE TxnDate >= 'PERIOD_START' AND TxnDate <= 'PERIOD_END' ORDER BY DocNumber
```

**Implementation**:
```typescript
const invoices = await makeQboQuery(accessToken, realmId,
  `SELECT DocNumber, TxnDate FROM Invoice 
   WHERE TxnDate >= '${periodStart}' AND TxnDate <= '${periodEnd}'
   ORDER BY DocNumber`
);

const docNumbers = invoices.QueryResponse.Invoice
  .map(i => parseInt(i.DocNumber))
  .filter(n => !isNaN(n))
  .sort((a, b) => a - b);

const gaps: number[] = [];
for (let i = 1; i < docNumbers.length; i++) {
  if (docNumbers[i] - docNumbers[i-1] > 1) {
    for (let missing = docNumbers[i-1] + 1; missing < docNumbers[i]; missing++) {
      gaps.push(missing);
    }
  }
}

return {
  check: 'No missing invoice numbers',
  status: gaps.length === 0 ? 'PASS' : 'WARNING',
  value: gaps.length === 0 ? 'Sequential' : `${gaps.length} gaps found`,
  gaps: gaps,
};
```

### C2. Debtors Ageing Within Tolerance

**Check**: 
- No invoices > 120 days old unless manually approved
- 60-day invoices < X% of total (e.g., 20%)

**API Approach**: Use the Aged Receivables Report

```typescript
const ageingReport = await makeQboApiRequest(
  accessToken, realmId,
  `/reports/AgedReceivables?date_macro=Today&aging_method=Report_Date`,
  'GET'
);
```

**Alternative - Query Open Invoices**:
```sql
SELECT Id, DocNumber, TxnDate, Balance, CustomerRef FROM Invoice 
WHERE Balance > '0' 
ORDER BY TxnDate
```

**Implementation**:
```typescript
const openInvoices = await makeQboQuery(accessToken, realmId,
  "SELECT * FROM Invoice WHERE Balance > '0'"
);

const today = new Date();
const totalReceivables = openInvoices.QueryResponse.Invoice
  .reduce((sum, inv) => sum + parseFloat(inv.Balance), 0);

const aged = {
  current: [] as Invoice[],      // 0-30 days
  thirtyDays: [] as Invoice[],   // 31-60 days
  sixtyDays: [] as Invoice[],    // 61-90 days
  ninetyDays: [] as Invoice[],   // 91-120 days
  overdue: [] as Invoice[],      // > 120 days
};

for (const invoice of openInvoices.QueryResponse.Invoice) {
  const daysOld = differenceInDays(today, new Date(invoice.TxnDate));
  
  if (daysOld <= 30) aged.current.push(invoice);
  else if (daysOld <= 60) aged.thirtyDays.push(invoice);
  else if (daysOld <= 90) aged.sixtyDays.push(invoice);
  else if (daysOld <= 120) aged.ninetyDays.push(invoice);
  else aged.overdue.push(invoice);
}

const sixtyDayTotal = [...aged.thirtyDays, ...aged.sixtyDays, ...aged.ninetyDays, ...aged.overdue]
  .reduce((sum, inv) => sum + parseFloat(inv.Balance), 0);

const sixtyDayPercent = (sixtyDayTotal / totalReceivables) * 100;

return {
  check: 'Debtors ageing within tolerance',
  status: aged.overdue.length === 0 && sixtyDayPercent <= 20 ? 'PASS' : 'WARNING',
  metrics: {
    totalReceivables,
    overdue120Days: aged.overdue.length,
    sixtyDayPercent: sixtyDayPercent.toFixed(1),
  },
  overdueInvoices: aged.overdue,
};
```

### C3. No Negative Debtor Balances

**Check**: No customer has a negative AR balance beyond -£5

**API Query**:
```sql
SELECT Id, DisplayName, Balance FROM Customer WHERE Balance < '-5'
```

**Implementation**:
```typescript
const customers = await makeQboQuery(accessToken, realmId,
  "SELECT Id, DisplayName, Balance FROM Customer WHERE Balance < '-5'"
);

return {
  check: 'No negative debtor balances',
  status: customers.QueryResponse.Customer?.length === 0 ? 'PASS' : 'FAIL',
  value: customers.QueryResponse.Customer?.length || 0,
  items: customers.QueryResponse.Customer || [],
};
```

### C4. Matched Receipts

**Check**: 
- Bank deposits allocated to invoices
- Unmatched receipts < X% of monthly sales

**API Query**:
```sql
SELECT * FROM Payment WHERE TxnDate >= 'PERIOD_START' AND TxnDate <= 'PERIOD_END'
SELECT * FROM Deposit WHERE TxnDate >= 'PERIOD_START' AND TxnDate <= 'PERIOD_END'
```

**Note**: Check `LinkedTxn` array on Payment objects to see if they're linked to Invoices.

---

## D. Purchases, AP & Expenses

### D1. No Old Unpaid Bills Without Approval

**Check**: Bills > 120 days old flagged unless noted

**API Query**:
```sql
SELECT * FROM Bill WHERE Balance > '0' ORDER BY TxnDate
```

**Implementation**: Similar to debtors ageing, but for `Bill` entity.

### D2. No Negative Supplier Balances

**Check**: No supplier shows < -£5 balance

**API Query**:
```sql
SELECT Id, DisplayName, Balance FROM Vendor WHERE Balance < '-5'
```

### D3. Large Expenses Coded Correctly

**Check**: Any transaction > £500 matches expected COA/VAT rules

**API Query**:
```sql
SELECT * FROM Purchase WHERE TotalAmt > '500' AND TxnDate >= 'PERIOD_START' AND TxnDate <= 'PERIOD_END'
```

**Implementation**:
```typescript
const largePurchases = await makeQboQuery(accessToken, realmId,
  `SELECT * FROM Purchase 
   WHERE TotalAmt > '500' 
   AND TxnDate >= '${periodStart}' AND TxnDate <= '${periodEnd}'`
);

// Flag items for review with their account coding
const flaggedItems = largePurchases.QueryResponse.Purchase.map(p => ({
  id: p.Id,
  amount: p.TotalAmt,
  date: p.TxnDate,
  account: p.Line[0]?.AccountBasedExpenseLineDetail?.AccountRef?.name,
  vendor: p.EntityRef?.name,
  // Check VAT coding in TxnTaxDetail
}));
```

### D4. Misc/Other/Suspense Postings Minimal

**Check**: 
- No single uncategorised entry > £50
- Total misc/suspense < £100

**API Approach**: Query transactions posted to suspense/misc accounts:

```typescript
// First, find suspense/miscellaneous accounts
const suspenseAccounts = await makeQboQuery(accessToken, realmId,
  "SELECT Id, Name FROM Account WHERE Name LIKE '%suspense%' OR Name LIKE '%misc%' OR Name LIKE '%ask my accountant%'"
);

// Then query transactions to those accounts
const suspenseAccountIds = suspenseAccounts.QueryResponse.Account.map(a => a.Id);

const transactions = await makeQboQuery(accessToken, realmId,
  `SELECT * FROM JournalEntry 
   WHERE TxnDate >= '${periodStart}' AND TxnDate <= '${periodEnd}'`
);

// Filter for lines hitting suspense accounts
```

---

## E. VAT & Indirect Taxes

### E1. Correct VAT Code Assignment by Category

**Check**: Categories use correct VAT codes:
- Insurance = Exempt
- Wages = No VAT
- Bank charges = Exempt
- Fuel = 20% or partial

**API Approach**: 

1. Get Tax Codes:
```sql
SELECT * FROM TaxCode
```

2. Query transactions by account type and check tax coding:
```typescript
// Get account categories
const accounts = await makeQboQuery(accessToken, realmId,
  "SELECT Id, Name, AccountType, AccountSubType FROM Account"
);

// Map accounts to expected VAT treatment
const vatRules = {
  'Insurance': 'Exempt',
  'Payroll': 'NoVAT',
  'Bank Charges': 'Exempt',
  'Fuel': 'Standard'
};

// Query transactions and validate VAT codes
```

### E2. Zero VAT Exceptions

**Check**: No transactions in VAT Exception report

**API Approach**: Use the VAT Exception Report if available:
```typescript
const vatExceptions = await makeQboApiRequest(
  accessToken, realmId,
  '/reports/VATExceptionReport',
  'GET'
);
```

### E3. VAT Return Reconciles to General Ledger

**Check**: VAT control balance matches return total ± £1

**API Query**:
```sql
SELECT Id, Name, CurrentBalance FROM Account WHERE Name LIKE '%VAT%' AND AccountType = 'Liability'
```

**Implementation**:
```typescript
const vatAccounts = await makeQboQuery(accessToken, realmId,
  "SELECT * FROM Account WHERE Name LIKE '%VAT%' OR Name LIKE '%Tax%'"
);

// Sum control accounts
const vatLiability = vatAccounts.QueryResponse.Account
  .filter(a => a.AccountType === 'Liability')
  .reduce((sum, a) => sum + parseFloat(a.CurrentBalance || 0), 0);
```

### E4. Variance vs Prior Quarter Within Range

**Check**: Output/Input VAT variance < ±25%

**API Approach**: Run Profit & Loss by quarter and extract VAT lines, or use the VAT Report endpoints.

---

## F. Journals & General Ledger

### F1. Payroll Journals Present

**Check**: At least 1 payroll journal in period with wages, employer NI lines

**API Query**:
```sql
SELECT * FROM JournalEntry 
WHERE TxnDate >= 'PERIOD_START' AND TxnDate <= 'PERIOD_END'
```

**Implementation**:
```typescript
const journals = await makeQboQuery(accessToken, realmId,
  `SELECT * FROM JournalEntry 
   WHERE TxnDate >= '${periodStart}' AND TxnDate <= '${periodEnd}'`
);

// Look for journals with payroll-related accounts
const payrollAccountNames = ['wages', 'salaries', 'paye', 'ni', 'national insurance', 'employer'];

const payrollJournals = journals.QueryResponse.JournalEntry?.filter(je => 
  je.Line.some(line => 
    payrollAccountNames.some(name => 
      line.JournalEntryLineDetail?.AccountRef?.name?.toLowerCase().includes(name)
    )
  )
);

return {
  check: 'Payroll journals present',
  status: payrollJournals?.length > 0 ? 'PASS' : 'FAIL',
  value: payrollJournals?.length || 0,
  journals: payrollJournals?.map(j => ({
    id: j.Id,
    date: j.TxnDate,
    total: j.TotalAmt
  })),
};
```

### F2. Depreciation Journals Done

**Check**: If fixed assets > £1,000, depreciation journal present

**API Query**:
```sql
SELECT * FROM Account WHERE AccountType = 'Fixed Asset'
```

**Implementation**:
```typescript
const fixedAssets = await makeQboQuery(accessToken, realmId,
  "SELECT * FROM Account WHERE AccountType = 'Fixed Asset'"
);

const totalFixedAssets = fixedAssets.QueryResponse.Account
  ?.reduce((sum, a) => sum + parseFloat(a.CurrentBalance || 0), 0) || 0;

if (totalFixedAssets > 1000) {
  // Look for depreciation journals
  const depreciationAccounts = await makeQboQuery(accessToken, realmId,
    "SELECT * FROM Account WHERE Name LIKE '%depreciation%'"
  );
  
  // Check for journals to depreciation accounts in the period
}
```

### F3. No Manual Journals to Restricted Accounts

**Check**: No JE posted to VAT control, Sales, DLA, Bank without approval

**Implementation**:
```typescript
// Define restricted account patterns
const restrictedPatterns = [
  { pattern: 'vat', reason: 'VAT Control' },
  { pattern: 'sales', reason: 'Revenue Account' },
  { pattern: 'director', reason: 'Directors Loan' },
  { pattern: 'bank', reason: 'Bank Account', accountType: 'Bank' },
];

const journals = await makeQboQuery(accessToken, realmId,
  `SELECT * FROM JournalEntry 
   WHERE TxnDate >= '${periodStart}' AND TxnDate <= '${periodEnd}'`
);

const violations = journals.QueryResponse.JournalEntry?.filter(je =>
  je.Line.some(line => 
    restrictedPatterns.some(r => 
      line.JournalEntryLineDetail?.AccountRef?.name?.toLowerCase().includes(r.pattern)
    )
  )
) || [];
```

### F4. Suspense and AMA = £0

**Check**: Both accounts balance = £0 ± £5

**API Query**:
```sql
SELECT * FROM Account WHERE Name LIKE '%suspense%' OR Name LIKE '%ask my accountant%' OR Name LIKE '%AMA%'
```

---

## G. Attachments & Audit Trail

### G1. Attachments Present Where Required

**Check**: All expenses > £50 have attachment or bill

**API Approach**:

1. Query transactions over £50:
```sql
SELECT * FROM Purchase WHERE TotalAmt > '50' AND TxnDate >= 'PERIOD_START'
```

2. Check for attachments via the Attachable entity:
```sql
SELECT * FROM Attachable WHERE AttachableRef.EntityRef.Type = 'Purchase' AND AttachableRef.EntityRef.value = 'PURCHASE_ID'
```

**Note**: This requires querying each transaction individually for attachments, which can be slow. Consider batching or sampling.

### G2. All Bank Feed Transactions Processed

**Check**: No bank transactions older than X days left unprocessed

**API Notes**: Bank feed data is not directly exposed via the standard API. This would require:
- Checking the Bank account transaction register
- Identifying uncleared/unlinked items

---

## H. Master Data

### H1. New Suppliers/Customers Approved

**Check**: All created this period flagged unless reviewed

**API Query**:
```sql
SELECT * FROM Customer WHERE MetaData.CreateTime >= 'PERIOD_START'
SELECT * FROM Vendor WHERE MetaData.CreateTime >= 'PERIOD_START'
```

### H2. No Duplicate Suppliers/Customers

**Check**: Similar names/emails/phone flagged

**Implementation**:
```typescript
const customers = await makeQboQuery(accessToken, realmId,
  "SELECT Id, DisplayName, PrimaryEmailAddr, PrimaryPhone FROM Customer"
);

// Find duplicates by name similarity
const duplicates = findDuplicates(customers.QueryResponse.Customer, [
  'DisplayName',
  'PrimaryEmailAddr.Address',
  'PrimaryPhone.FreeFormNumber'
]);

return {
  check: 'No duplicate customers',
  status: duplicates.length === 0 ? 'PASS' : 'WARNING',
  duplicates: duplicates,
};
```

### H3. New COA Accounts Reviewed

**Check**: Any account created this period must be approved

**API Query**:
```sql
SELECT * FROM Account WHERE MetaData.CreateTime >= 'PERIOD_START'
```

---

## I. Analytical Sanity Tests

### I1. Turnover Trend Within Expected Band

**Check**: Revenue within ±25% of average of last 3 comparable months

**API Approach**: Use the Profit & Loss Report:

```typescript
const plReport = await makeQboApiRequest(
  accessToken, realmId,
  `/reports/ProfitAndLoss?start_date=${periodStart}&end_date=${periodEnd}`,
  'GET'
);

// Compare against prior periods
const priorReport = await makeQboApiRequest(
  accessToken, realmId,
  `/reports/ProfitAndLoss?start_date=${priorStart}&end_date=${priorEnd}`,
  'GET'
);
```

### I2. Gross Margin Within Expected Band

**Check**: GM% within ±10% of prior 3 months average

**API Implementation**: Extract from P&L report:

```typescript
interface PLReport {
  Rows: {
    Row: Array<{
      Summary?: { ColData: Array<{ value: string }> };
      group?: string;
    }>;
  };
}

// Parse report to extract Revenue and Cost of Sales
// Calculate GM% = (Revenue - COGS) / Revenue * 100
```

### I3. Operating Expense Spikes Detected

**Check**: Categories with > 200% spike flagged

**Implementation**:
```typescript
// Get expense breakdown from P&L
// Compare each category to prior period average
// Flag any with variance > 200% or > £1,000 absolute
```

### I4. Directors Loan Account Movement Reconciled

**Check**: Net DLA movement explained by dividends, payroll, drawings, transfers, expense claims

**API Query**:
```sql
SELECT * FROM Account WHERE Name LIKE '%director%loan%'
```

Then query all transactions to/from that account and categorise.

### I5. Profit Variance Check

**Check**: Net profit variance vs prior 3-month average within ±30%

**API Implementation**: Use P&L reports for current and prior periods.

---

## Data Presentation Strategy

### QC Dashboard Structure

```typescript
interface QCReport {
  id: string;
  clientId: string;
  realmId: string;
  period: QCPeriod;
  runAt: Date;
  runBy: string;
  
  summary: {
    totalChecks: number;
    passed: number;
    warnings: number;
    failed: number;
    score: number;  // 0-100%
  };
  
  sections: {
    periodControl: QCSection;
    bankAndCash: QCSection;
    salesAndAR: QCSection;
    purchasesAndAP: QCSection;
    vatAndTax: QCSection;
    journalsAndGL: QCSection;
    attachmentsAudit: QCSection;
    masterData: QCSection;
    analytics: QCSection;
  };
}

interface QCSection {
  name: string;
  status: 'PASS' | 'WARNING' | 'FAIL';
  checks: QCCheck[];
}

interface QCCheck {
  id: string;
  name: string;
  description: string;
  status: 'PASS' | 'WARNING' | 'FAIL' | 'SKIPPED';
  value: string | number;
  expected: string;
  items?: QCItem[];  // Flagged transactions/entities
  approved?: boolean;
  approvedBy?: string;
  approvalNote?: string;
}
```

### Traffic Light System

| Status | Colour | Meaning |
|--------|--------|---------|
| PASS | 🟢 Green | Check passed, no action needed |
| WARNING | 🟡 Amber | Requires review, may need approval |
| FAIL | 🔴 Red | Critical issue, must be resolved |
| SKIPPED | ⚪ Grey | Check not applicable or data unavailable |

### Approval Workflow

For items flagged as WARNING or FAIL:

1. **Flag** - System identifies the issue
2. **Review** - Staff member examines the flagged items
3. **Approve/Reject** - Staff either:
   - Approves with a note explaining why it's acceptable
   - Creates a task to fix the issue
4. **Document** - Approval is logged for audit trail

---

## API Rate Limiting & Performance

### QuickBooks API Limits

- **Sandbox**: 500 requests per minute
- **Production**: 500 requests per minute per realm
- **Batch Limit**: Up to 30 requests per batch

### Optimisation Strategies

1. **Batch Queries**: Combine related queries where possible
2. **Caching**: Cache static data (accounts, tax codes) for the session
3. **Parallel Requests**: Run independent checks concurrently
4. **Incremental Updates**: Only fetch changes since last run using `MetaData.LastUpdatedTime`

### Estimated API Calls Per Full QC Run

| Section | Estimated Calls |
|---------|-----------------|
| Period Control | 5-10 |
| Bank & Cash | 3-5 per bank account |
| Sales & AR | 5-8 |
| Purchases & AP | 5-8 |
| VAT & Tax | 3-5 |
| Journals & GL | 3-5 |
| Attachments | 1 + 1 per large txn (sample) |
| Master Data | 3-5 |
| Analytics | 4-6 (reports) |
| **Total** | ~50-80 calls |

---

## Future Phases Preview

### Phase 2: Financial Insights & KPIs

- Turnover by month/quarter with trend analysis
- Profit margins and benchmarking
- Cash flow summary
- Debtor/Creditor days
- Top customers/suppliers
- Expense categorisation breakdown

### Phase 3: AI-Generated Advisory Comments

- Natural language summary of financial position
- Identification of opportunities (cost savings, revenue growth)
- Risk highlighting (cash flow concerns, concentration risk)
- Benchmarking against industry averages
- Actionable recommendations

### Phase 4: Beautiful Client Reports

- Branded PDF/HTML reports
- Interactive dashboards
- Client portal integration
- Scheduled automated distribution
- Value messaging and service documentation

---

## Database Schema (Proposed)

### QC Run Storage

```typescript
// QC Run metadata
export const qboQcRuns = pgTable("qbo_qc_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  connectionId: varchar("connection_id").references(() => qboConnections.id),
  clientId: varchar("client_id").references(() => clients.id),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  status: varchar("status").notNull(), // 'running', 'completed', 'failed'
  totalChecks: integer("total_checks"),
  passedChecks: integer("passed_checks"),
  warningChecks: integer("warning_checks"),
  failedChecks: integer("failed_checks"),
  score: decimal("score"),
  runBy: varchar("run_by").references(() => users.id),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
});

// Individual check results
export const qboQcCheckResults = pgTable("qbo_qc_check_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").references(() => qboQcRuns.id),
  checkCode: varchar("check_code").notNull(), // e.g., 'A1', 'B2'
  checkName: varchar("check_name").notNull(),
  section: varchar("section").notNull(),
  status: varchar("status").notNull(), // 'PASS', 'WARNING', 'FAIL', 'SKIPPED'
  value: text("value"),
  expected: text("expected"),
  details: jsonb("details"), // Flagged items, metrics, etc.
  approved: boolean("approved").default(false),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvalNote: text("approval_note"),
  approvedAt: timestamp("approved_at"),
});
```

---

## Next Steps

1. **Phase 1 Implementation**:
   - [ ] Create QC service module with check implementations
   - [ ] Build QC Run API endpoints
   - [ ] Develop frontend QC dashboard
   - [ ] Implement approval workflow
   - [ ] Add QC integration to project workflow

2. **Testing**:
   - [ ] Test with connected sandbox account
   - [ ] Validate all API queries work correctly
   - [ ] Performance testing with rate limiting
   - [ ] Edge case handling

3. **Documentation**:
   - [ ] User guide for running QC checks
   - [ ] Admin guide for configuring thresholds
   - [ ] API documentation for integration
