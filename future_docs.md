# FutureBooks QC System - Business Logic Documentation

## Overview

The FutureBooks Quality Control (QC) system automates bookkeeping quality checks across 9 categories, providing accounting firms with automated assessment of client QuickBooks data. This document describes the business logic, thresholds, and criteria used to determine check statuses.

## Status Definitions

| Status | Description | UI Color |
|--------|-------------|----------|
| **Pass** | Check completed successfully with no issues found | Green |
| **Warning** | Issues found that need review but aren't critical | Amber |
| **Fail** | Critical issues found that require immediate attention | Red |
| **Blocked** | Check could not complete due to API/access issues | Gray |

## QC Categories

The system organizes checks into 9 sections:
1. Period Control - Ensuring accounting periods are properly managed
2. Bank & Cash - Verifying bank reconciliation and cash handling
3. Sales & AR - Accounts receivable health and invoice integrity
4. Purchases & AP - Accounts payable management
5. VAT - Tax compliance and coding accuracy
6. Journals - Journal entry integrity
7. Attachments - Supporting documentation (planned)
8. Master Data - Data quality audits (planned)
9. Analytics - Financial insights and KPIs (planned)

---

## Implemented QC Checks

### A1: Period Lock Status
**Section:** Period Control  
**Purpose:** Verifies that the accounting period is properly closed/locked to prevent unauthorized changes.

| Status | Criteria |
|--------|----------|
| Pass | Book close date is set AND is on or after the selected period end date |
| Warning | No book close date configured OR close date is before period end |
| Blocked | API error fetching preferences |

**QuickBooks Data Used:** `Preferences.AccountingInfoPrefs.BookCloseDate`

**Business Rationale:** A locked period prevents accidental or unauthorized changes to historical data, ensuring data integrity for reporting and compliance.

---

### A2: Backdated Entries
**Section:** Period Control  
**Purpose:** Identifies transactions that were created or modified after the period ended but dated within the period (potential backdating).

| Status | Criteria |
|--------|----------|
| Pass | No transactions found that were modified after period end |
| Warning | 1-5 backdated transactions found |
| Fail | More than 5 backdated transactions found |
| Blocked | API error querying transactions |

**Thresholds:**
- Warning threshold: 1-5 items
- Fail threshold: >5 items

**Transaction Types Checked:** Invoice, Bill, JournalEntry, Deposit

**Business Rationale:** Backdated entries can indicate errors, fraud, or poor process control. A small number may be legitimate corrections, but patterns of backdating warrant investigation.

---

### A3: Future-Dated Entries
**Section:** Period Control  
**Purpose:** Identifies transactions dated after the selected period (may indicate data entry errors or intentional future posting).

| Status | Criteria |
|--------|----------|
| Pass | No future-dated transactions found |
| Warning | Any future-dated transactions found |
| Blocked | API error querying transactions |

**Note:** This check uses Warning (not Fail) because future-dated entries may be intentional (e.g., recurring invoices, scheduled payments).

**Transaction Types Checked:** Invoice, Bill, JournalEntry

**Business Rationale:** While some future dating is intentional, unexpected entries may indicate data entry errors or process issues.

---

### B3: Unreconciled Cash Transactions
**Section:** Bank & Cash  
**Purpose:** Identifies bank and cash accounts with transactions that may not be reconciled.

| Status | Criteria |
|--------|----------|
| Pass | No bank accounts found OR no transactions requiring review |
| Warning | Bank accounts found with deposits to review |
| Blocked | API error fetching accounts or transactions |

**Accounts Checked:** Bank accounts and accounts with "cash" in the name (limited to first 5 accounts)

**QuickBooks Data Used:** Account query, Deposit query per account

**Business Rationale:** Unreconciled transactions indicate incomplete month-end close procedures and potential discrepancies between books and bank statements.

---

### B4: Undeposited Funds Balance
**Section:** Bank & Cash  
**Purpose:** Checks for payments sitting in the Undeposited Funds account (received but not yet deposited).

| Status | Criteria |
|--------|----------|
| Pass | Balance is $0.00 OR no undeposited funds account exists |
| Warning | Balance is between $500 and $5,000 |
| Fail | Balance exceeds $5,000 |
| Blocked | API error fetching account data |

**Thresholds:**
- Pass: < $500
- Warning: $500 - $5,000
- Fail: > $5,000

**QuickBooks Data Used:** Account (Other Current Asset type), Payment records

**Business Rationale:** Undeposited funds represent cash received but not yet recorded in the bank. Large balances indicate delayed deposits, potential cash flow issues, or reconciliation problems.

---

### C1: Invoice Number Sequencing
**Section:** Sales & AR  
**Purpose:** Checks for gaps or duplicates in invoice numbering within the period.

| Status | Criteria |
|--------|----------|
| Pass | All invoice numbers are sequential with no gaps or duplicates |
| Warning | Gaps found in invoice numbering sequence |
| Fail | Duplicate invoice numbers found |
| Blocked | API error querying invoices |

**Business Rationale:** 
- **Gaps** may indicate deleted invoices, voided transactions, or multi-user conflicts
- **Duplicates** are more serious as they can cause confusion, payment misallocation, and audit issues

**Note:** Only numeric invoice numbers are analyzed. Alphanumeric prefixes are stripped before comparison.

---

### C2: Accounts Receivable Ageing
**Section:** Sales & AR  
**Purpose:** Analyzes aged receivables to identify overdue amounts and collection risks.

| Status | Criteria |
|--------|----------|
| Pass | All balances are current (within terms) or 1-30 days overdue |
| Warning | Balances are 60-90 days overdue |
| Fail | Balances are more than 90 days overdue |
| Blocked | API error querying invoices |

**Ageing Buckets:**
- Current: Not yet due
- 1-30 days: Recently overdue
- 31-60 days: Moderately overdue
- 61-90 days: Warning territory
- 90+ days: Requires immediate attention

**QuickBooks Data Used:** Invoice records with Balance > 0

**Business Rationale:** Aged receivables indicate collection problems, potential bad debts, and cash flow risks. The longer debt ages, the less likely it is to be collected.

---

### D2: Accounts Payable Ageing
**Section:** Purchases & AP  
**Purpose:** Analyzes aged payables to identify overdue obligations and potential cash flow issues.

| Status | Criteria |
|--------|----------|
| Pass | All balances are current (within terms) or 1-30 days overdue |
| Warning | Balances are 60-90 days overdue |
| Fail | Balances are more than 90 days overdue |
| Blocked | API error querying bills |

**Ageing Buckets:** Same as AR Ageing

**QuickBooks Data Used:** Bill records with Balance > 0

**Business Rationale:** Overdue payables can damage supplier relationships, incur late fees, and indicate cash flow problems. Very aged payables may also suggest disputes or data issues.

---

### E1: VAT/GST Compliance
**Section:** VAT  
**Purpose:** Checks for transactions missing tax codes, which could cause VAT return inaccuracies.

| Status | Criteria |
|--------|----------|
| Pass | All taxable transactions have proper tax coding |
| Warning | 1-10 transactions are missing tax codes or have no tax charged |
| Fail | More than 10 transactions are missing tax codes |
| Blocked | API error querying transactions |

**Thresholds:**
- Pass: 0 issues
- Warning: 1-10 issues
- Fail: >10 issues

**Transaction Types Checked:** Invoice, Bill

**What Triggers an Issue:**
- Invoice with no TxnTaxDetail or TotalTax = 0
- Invoice line items missing TaxCodeRef
- Bill with no TxnTaxDetail or TotalTax = 0

**Business Rationale:** Missing tax codes can cause:
- Incorrect VAT returns
- HMRC penalties and interest
- Failed Making Tax Digital (MTD) submissions
- Audit findings

**Note:** Some transactions legitimately have no VAT (e.g., exempt supplies, out-of-scope items). Review is needed to distinguish errors from correct zero-rating.

---

### F1: Journal Entry Balance
**Section:** Journals  
**Purpose:** Verifies that all journal entries within the period are balanced (debits = credits).

| Status | Criteria |
|--------|----------|
| Pass | All journal entries are balanced |
| Fail | One or more journal entries are unbalanced |
| Blocked | API error querying journal entries |

**Balance Tolerance:** £0.01 (to account for rounding)

**QuickBooks Data Used:** JournalEntry records within period

**Business Rationale:** Unbalanced journal entries violate fundamental accounting principles and indicate data corruption or entry errors. QuickBooks normally prevents unbalanced entries, so finding them suggests API imports or system issues.

---

## Understanding "Blocked" Status

A check returns **Blocked** when it cannot complete due to:

1. **Token/Authentication Issues**
   - Access token expired
   - Refresh token invalid
   - OAuth connection revoked

2. **API Rate Limiting**
   - Too many requests to QuickBooks API
   - Throttling applied by Intuit

3. **Permission Issues**
   - App doesn't have permission to read certain data
   - Company file restrictions

4. **Data Not Available**
   - Feature not enabled for the company (e.g., no inventory tracking)
   - Data type doesn't exist in this QuickBooks edition

5. **Query Errors**
   - Invalid date ranges
   - Malformed queries
   - Data format issues

**Recommended Action:** When checks are blocked, verify the QuickBooks connection status and re-authorize if needed.

---

## Scoring Methodology

The overall QC score is calculated as:

```
Score = ((Passed × 1.0) + (Warnings × 0.5)) / Total Checks × 100
```

Where:
- **Passed checks** receive full credit (1.0 points each)
- **Warning checks** receive half credit (0.5 points each)
- **Failed checks** receive no credit (0 points)
- **Blocked checks** receive no credit (0 points) but are included in total

**Score Interpretation:**
| Score | Interpretation |
|-------|---------------|
| 80-100% | Good - Minor issues only |
| 60-79% | Needs Attention - Several issues to review |
| 0-59% | Critical - Significant problems found |

**Note:** Blocked checks negatively impact the score since they cannot be evaluated. Resolve connection/permission issues to improve scores.

---

## Future Enhancements

### Planned Checks

| Code | Name | Section | Description |
|------|------|---------|-------------|
| G1 | Attachment Coverage | Attachments | Verify journal entries have supporting documents |
| G2 | Duplicate Bills | Purchases/AP | Detect potential duplicate vendor bills |
| H1 | Master Data Quality | Master Data | Check for inactive/duplicate items, vendors |
| I1 | Profit & Loss Variance | Analytics | Compare P&L to prior periods |
| I2 | Cash Flow Analysis | Analytics | Identify cash flow concerns |

### Configurable Thresholds (Planned)

Future versions will allow firms to customize:
- Undeposited funds warning/fail thresholds
- Ageing bucket definitions (30/60/90 vs custom)
- VAT issue thresholds
- Backdated entry thresholds

### Additional QuickBooks Endpoints to Leverage

| Endpoint | Use Case |
|----------|----------|
| Reports API | TrialBalance, P&L, Balance Sheet for analytics |
| Attachable | Check for supporting documentation |
| Transfer | Track inter-account transfers |
| TaxCode/TaxRate | Validate tax code assignments |
| Vendor | Duplicate vendor detection |
| Class/Department | Categorization completeness |

---

## API Rate Limiting

The QC system implements rate limiting to respect QuickBooks API limits:
- Maximum 500 calls per minute
- 50ms minimum delay between calls
- Automatic throttling when approaching limits

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-01 | 1.0 | Initial documentation of 10 QC checks |
