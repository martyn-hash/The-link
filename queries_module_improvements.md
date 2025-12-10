# Queries Module Improvements Plan

**Created:** December 10, 2025  
**Status:** Planning  
**Priority:** High

---

## Executive Summary

This document outlines the implementation plan for improving the Bookkeeping Queries module based on staff feedback. The main themes are:

1. **Query Grouping** - Reduce client overwhelm by grouping related transactions (e.g., all queries for the same supplier/customer)
2. **Enhanced Filtering** - Allow staff to quickly find and manage related queries
3. **Notification Improvements** - Fix existing bugs and add assignee notification when clients respond
4. **Bug Fixes** - Address issues with the Notify button and Cancel All Pending button in Kanban modal

---

## Current Architecture Overview

### Database Schema
- **`bookkeeping_queries`** - Core query table with projectId, description, moneyIn/Out, status, etc.
- **`query_response_tokens`** - Tokens for client response links, tracks queryIds array
- **`scheduled_query_reminders`** - Scheduled email/SMS/voice reminders linked to tokens

### Key Components
- **Frontend:** `QueriesTab.tsx`, `ScheduledRemindersPanel.tsx`, `query-response.tsx` (client-facing)
- **Backend:** `server/routes/queries.ts`, `server/storage/queries/queryStorage.ts`
- **Services:** `queryReminderService.ts`, `notification-sender.ts`

---

## Stage 1: Bug Fixes (Priority: Critical)

### 1.1 Fix "Notify" Button Not Finding Assignees

**Problem:** The Notify button in the Queries tab shows no assignees to notify when clicked.

**Root Cause Analysis:**
The `projectAssignees` query is only enabled when `isNotifyDialogOpen` is true. The query fetches from `/api/projects/:projectId/assignees` which returns project assignments with nested user data.

```typescript
// Current code in QueriesTab.tsx (line 265-275)
const { data: projectAssignees } = useQuery<{
  id: string;
  projectId: string;
  userId: string;
  roleId: string | null;
  user: { id: string; firstName: string | null; lastName: string | null; email: string };
  role: { id: string; name: string } | null;
}[]>({
  queryKey: ['/api/projects', projectId, 'assignees'],
  enabled: isNotifyDialogOpen,
});
```

**Investigation Required:**
1. Verify the `/api/projects/:projectId/assignees` endpoint returns the correct data structure
2. Check if the project has assignees in the database
3. Ensure the dialog correctly maps and displays the assignees

**Fix Steps:**
1. Add logging/debugging to confirm API response
2. Verify the Notify dialog renders the assignees list correctly
3. Check if there's a timing issue (dialog opens before data loads)
4. Add loading state to the dialog while assignees are being fetched

**Estimated Effort:** 2-4 hours

---

### 1.2 Fix "Cancel All Pending" Button in Kanban Modal

**Problem:** The "Cancel All Pending" button works on the project detail page but not in the Kanban card modal.

**Root Cause Analysis:**
The `ScheduledRemindersPanel` component is rendered inside the `MessagesModal` which is displayed from Kanban cards. The cancel functionality calls:

```typescript
// ScheduledRemindersPanel.tsx (line 180-198)
const cancelAllMutation = useMutation({
  mutationFn: async (tokenId: string) => {
    return apiRequest('POST', `/api/query-tokens/${tokenId}/cancel-reminders`);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'query-reminders'] });
    // ...
  },
});
```

**Potential Issues:**
1. The `tokenId` might not be correctly passed from the reminders data
2. The modal context may not have the same project ID as expected
3. Cache invalidation may be using wrong query keys

**Investigation Required:**
1. Verify `tokenIds` array is correctly populated in the modal context
2. Check if `hasMultipleTokens` logic is incorrectly hiding the button
3. Confirm the API call is being made with correct parameters

**Fix Steps:**
1. Add console logging to trace the cancel flow in the modal
2. Verify tokenId is available when button is clicked
3. Check network requests to confirm API calls are made
4. Ensure error messages are displayed if the call fails

**Estimated Effort:** 2-4 hours

---

## Stage 2: Enhanced Filtering (Priority: High)

### 2.1 Add Description Search Filter

**Feature:** Allow staff to search queries by description text to quickly find all transactions from the same supplier/customer.

**UI Design:**
```
┌─────────────────────────────────────────────────────────────────┐
│ [All Statuses ▼]  [🔍 Search descriptions...              ]    │
│                                                                 │
│ Results: 15 queries matching "Barclays"                         │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:**

1. **Frontend Changes (`QueriesTab.tsx`):**
   ```typescript
   const [searchTerm, setSearchTerm] = useState("");
   
   const filteredQueries = useMemo(() => {
     let result = queries || [];
     
     // Status filter
     if (filterStatus !== "all") {
       result = result.filter(q => q.status === filterStatus);
     }
     
     // Description search (case-insensitive)
     if (searchTerm.trim()) {
       const term = searchTerm.toLowerCase();
       result = result.filter(q => 
         q.description?.toLowerCase().includes(term) ||
         q.ourQuery?.toLowerCase().includes(term)
       );
     }
     
     return result;
   }, [queries, filterStatus, searchTerm]);
   ```

2. **Add Search Input Component:**
   - Debounced input (300ms) to avoid excessive re-renders
   - Clear button to reset search
   - Show result count when searching

**Estimated Effort:** 3-4 hours

---

### 2.2 Add Money In/Out Filter

**Feature:** Allow filtering queries by transaction direction (money in vs money out).

**UI Design:**
```
┌─────────────────────────────────────────────────────────────────┐
│ [All Statuses ▼]  [All Amounts ▼]  [🔍 Search...          ]    │
│                    ├─ All Amounts                               │
│                    ├─ Money In                                  │
│                    └─ Money Out                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:**

1. **Add Filter State:**
   ```typescript
   const [amountFilter, setAmountFilter] = useState<"all" | "in" | "out">("all");
   ```

2. **Apply Filter:**
   ```typescript
   if (amountFilter === "in") {
     result = result.filter(q => q.moneyIn && parseFloat(q.moneyIn) > 0);
   } else if (amountFilter === "out") {
     result = result.filter(q => q.moneyOut && parseFloat(q.moneyOut) > 0);
   }
   ```

**Estimated Effort:** 1-2 hours

---

## Stage 3: Query Grouping (Priority: High)

### 3.1 Database Schema Changes

**New Table: `query_groups`**
```sql
CREATE TABLE query_groups (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  group_name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by_id VARCHAR NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_query_groups_project_id ON query_groups(project_id);
```

**Add Column to `bookkeeping_queries`:**
```sql
ALTER TABLE bookkeeping_queries 
ADD COLUMN group_id VARCHAR REFERENCES query_groups(id) ON DELETE SET NULL;

CREATE INDEX idx_bookkeeping_queries_group_id ON bookkeeping_queries(group_id);
```

**Drizzle Schema (`shared/schema/queries/tables.ts`):**
```typescript
export const queryGroups = pgTable("query_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  groupName: varchar("group_name", { length: 255 }).notNull(),
  description: text("description"),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_query_groups_project_id").on(table.projectId),
]);

// Update bookkeepingQueries table to add groupId
groupId: varchar("group_id").references(() => queryGroups.id, { onDelete: "set null" }),
```

**Estimated Effort:** 2-3 hours

---

### 3.2 Manual Grouping Feature

**User Flow:**
1. Staff searches for "Barclays" in the description filter
2. System shows all matching queries
3. Staff selects the queries they want to group
4. Staff clicks "Group Selected" button
5. Dialog prompts for group name (auto-suggested: "Barclays")
6. Queries are linked to the new group

**UI Design:**
```
┌─────────────────────────────────────────────────────────────────┐
│ [🔍 Barclays                    ]   [Clear]                     │
│ Showing 8 queries matching "Barclays"                           │
├─────────────────────────────────────────────────────────────────┤
│ ☑ Select All                                                    │
│                                                                 │
│ [3 selected]  [Group Selected ▼]  [Send to Client]  [Resolve]   │
│               ├─ Create New Group...                            │
│               └─ Add to Existing Group ►                        │
└─────────────────────────────────────────────────────────────────┘
```

**Create Group Dialog:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Create Query Group                                             │
├─────────────────────────────────────────────────────────────────┤
│  Group Name: [Barclays                              ]           │
│                                                                 │
│  Description (optional):                                        │
│  [All queries related to Barclays bank account    ]             │
│                                                                 │
│  Queries to include: 8                                          │
│                                                                 │
│  [Cancel]                               [Create Group]          │
└─────────────────────────────────────────────────────────────────┘
```

**Backend API:**

```typescript
// POST /api/projects/:projectId/query-groups
interface CreateGroupRequest {
  groupName: string;
  description?: string;
  queryIds: string[];
}

// PATCH /api/query-groups/:groupId
interface UpdateGroupRequest {
  groupName?: string;
  description?: string;
  queryIds?: string[]; // Add queries to group
}

// DELETE /api/query-groups/:groupId
// Removes the group, queries are unlinked (groupId set to null)

// PATCH /api/queries/:queryId/group
interface UpdateQueryGroupRequest {
  groupId: string | null; // null to remove from group
}
```

**Estimated Effort:** 8-10 hours

---

### 3.3 Grouped View for Client Response Page

**Problem:** When queries are grouped, the client should see ONE card per group instead of separate cards for each transaction.

**Client View Design (Mobile - Grouped):**
```
┌─────────────────────────────────────────────────────────────────┐
│  Query 1 of 3                                       [Barclays]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📦 Group: Barclays (5 transactions)                            │
│                                                                 │
│  [View All 5 Transactions ▼]                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 15 Nov  Barclays Bank Interest  £12.50 in                  ││
│  │ 18 Nov  Barclays Bank Fee       £15.00 out                 ││
│  │ 22 Nov  Barclays Transfer       £500.00 in                 ││
│  │ 25 Nov  Barclays DD             £45.00 out                 ││
│  │ 28 Nov  Barclays Refund         £25.00 in                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Our Question:                                                  │
│  "Please confirm the nature of these Barclays transactions"     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Your Response:                                              ││
│  │ [These are all normal bank transactions...]                 ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  📎 Attach Receipt/Invoice                                      │
│                                                                 │
│  [← Previous]    [Next →]                                       │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:**

1. **Backend Changes:**
   - Modify `getQueriesForToken` to return grouped data
   - Add group information to the response

2. **Frontend Changes (`query-response.tsx`):**
   - Detect grouped queries
   - Render collapsible transaction list for groups
   - Single response field applies to all queries in group
   - When client submits, response is saved to all queries in group

**Data Structure for Client Response:**
```typescript
interface GroupedQuery {
  groupId: string;
  groupName: string;
  queries: Query[];
  ourQuery: string; // Consolidated query text
}

interface TokenData {
  // ... existing fields
  queries: Query[];
  groupedQueries: GroupedQuery[]; // For grouped items
  ungroupedQueries: Query[]; // For non-grouped items
}
```

**Estimated Effort:** 10-12 hours

---

### 3.4 Edit/Remove Queries from Groups

**Features:**
- View all groups for a project
- Edit group name/description
- Add/remove individual queries from a group
- Delete entire group (queries remain, just unlinked)

**UI Location:** Add "Manage Groups" button to QueriesTab header

**Manage Groups Panel:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Query Groups                                        [+ New]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📦 Barclays (5 queries)                        [Edit] [Delete] │
│  📦 Amazon Purchases (3 queries)                [Edit] [Delete] │
│  📦 Travel Expenses (8 queries)                 [Edit] [Delete] │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Edit Group Dialog:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Edit Group: Barclays                                           │
├─────────────────────────────────────────────────────────────────┤
│  Name: [Barclays                                    ]           │
│                                                                 │
│  Queries in this group:                                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ☑ 15 Nov - Barclays Bank Interest - £12.50     [Remove]    ││
│  │ ☑ 18 Nov - Barclays Bank Fee - £15.00          [Remove]    ││
│  │ ☑ 22 Nov - Barclays Transfer - £500.00         [Remove]    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  [+ Add Queries to Group]                                       │
│                                                                 │
│  [Cancel]                                   [Save Changes]      │
└─────────────────────────────────────────────────────────────────┘
```

**Estimated Effort:** 6-8 hours

---

## Stage 4: Auto-Grouping Feature (Priority: Medium)

### 4.1 Auto-Group Algorithm

**Feature:** System analyzes query descriptions and proposes groupings based on common prefixes/patterns.

**Algorithm:**
```typescript
function autoGroupQueries(queries: Query[]): ProposedGroup[] {
  const groups: Map<string, Query[]> = new Map();
  const MIN_PREFIX_LENGTH = 4;
  const MIN_GROUP_SIZE = 2;
  
  // Normalize descriptions
  const normalizedQueries = queries.map(q => ({
    ...q,
    normalizedDesc: normalizeDescription(q.description || "")
  }));
  
  // Find common prefixes
  for (const query of normalizedQueries) {
    if (!query.normalizedDesc) continue;
    
    // Try different prefix lengths (from 4 to 20 chars)
    for (let len = MIN_PREFIX_LENGTH; len <= Math.min(20, query.normalizedDesc.length); len++) {
      const prefix = query.normalizedDesc.substring(0, len);
      
      if (!groups.has(prefix)) {
        groups.set(prefix, []);
      }
      groups.get(prefix)!.push(query);
    }
  }
  
  // Filter to groups with minimum size and select longest useful prefix
  const validGroups = selectBestGroups(groups, MIN_GROUP_SIZE);
  
  return validGroups.map(g => ({
    proposedName: extractGroupName(g.prefix),
    queries: g.queries,
    matchedPrefix: g.prefix
  }));
}

function normalizeDescription(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ')        // Normalize whitespace
    .trim();
}

function extractGroupName(prefix: string): string {
  // Convert "barclays bank" to "Barclays Bank"
  return prefix
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
```

**Estimated Effort:** 6-8 hours

---

### 4.2 Auto-Group UI

**User Flow:**
1. Staff clicks "Auto-Group" button
2. System analyzes all ungrouped queries
3. System presents proposed groupings for review
4. Staff can:
   - Accept a grouping (creates the group)
   - Reject a grouping (dismissed)
   - Remove individual queries from a proposed group
   - Edit the proposed group name
5. Staff confirms selections

**Auto-Group Review Dialog:**
```
┌─────────────────────────────────────────────────────────────────┐
│  🔮 Proposed Groupings                                          │
│  We found 4 potential groups from 23 ungrouped queries          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ☑ Barclays Bank (6 queries)                     [Rename]  │ │
│  │   ├─ ☑ 15 Nov - Barclays Bank Interest - £12.50           │ │
│  │   ├─ ☑ 18 Nov - Barclays Bank Fee - £15.00                │ │
│  │   ├─ ☑ 22 Nov - Barclays Bank Transfer - £500.00          │ │
│  │   ├─ ☐ 23 Nov - Barclays Card Payment - £25.00  ← Remove  │ │
│  │   ├─ ☑ 25 Nov - Barclays Bank DD - £45.00                 │ │
│  │   └─ ☑ 28 Nov - Barclays Bank Refund - £25.00             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ☑ Amazon (4 queries)                            [Rename]  │ │
│  │   ├─ ☑ 10 Nov - Amazon Prime - £9.99                      │ │
│  │   ├─ ☑ 12 Nov - Amazon Marketplace - £45.00               │ │
│  │   ├─ ☑ 20 Nov - Amazon Web Services - £150.00             │ │
│  │   └─ ☑ 25 Nov - Amazon Refund - £15.00                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ☐ TFL Travel (3 queries) ← Reject entire group            │ │
│  │   ...                                                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [Cancel]                       [Create 2 Selected Groups]      │
└─────────────────────────────────────────────────────────────────┘
```

**Backend API:**

```typescript
// POST /api/projects/:projectId/queries/auto-group/propose
// Returns proposed groupings without creating them
interface AutoGroupProposeResponse {
  proposals: {
    proposedName: string;
    queryIds: string[];
    matchedPrefix: string;
  }[];
  ungroupableCount: number; // Queries that don't match any pattern
}

// POST /api/projects/:projectId/queries/auto-group/apply
// Creates the confirmed groups
interface AutoGroupApplyRequest {
  groups: {
    groupName: string;
    queryIds: string[];
  }[];
}
```

**Estimated Effort:** 8-10 hours

---

## Stage 5: Notification Improvements (Priority: Medium)

### 5.1 Notify Assignees When Client Answers Queries

**Feature:** Option during query scheduling to notify project assignees when the client submits responses.

**Implementation:**

1. **Database Changes:**
   Add column to `query_response_tokens`:
   ```sql
   ALTER TABLE query_response_tokens 
   ADD COLUMN notify_on_response_user_ids TEXT[] DEFAULT '{}';
   ```

2. **UI Changes (Send to Client Flow):**
   Add step in scheduling dialog:
   ```
   ┌─────────────────────────────────────────────────────────────────┐
   │  Notify when client responds?                                   │
   │                                                                 │
   │  ☑ Sarah Johnson (Client Manager)                               │
   │  ☑ Mike Smith (Bookkeeper)                                      │
   │  ☐ Admin User                                                   │
   │                                                                 │
   │  These people will receive an email notification as soon as     │
   │  the client submits their responses.                            │
   └─────────────────────────────────────────────────────────────────┘
   ```

3. **Backend Trigger:**
   In the client response submission endpoint (`POST /api/query-response/:token`):
   ```typescript
   // After saving responses...
   if (token.notifyOnResponseUserIds?.length > 0) {
     for (const userId of token.notifyOnResponseUserIds) {
       await sendQueryAnsweredNotification(userId, token, project);
     }
   }
   ```

4. **Notification Content:**
   - Email subject: "Client Responded: [Project Name] Queries"
   - Email body: Summary of responses + link to project

**Estimated Effort:** 6-8 hours

---

### 5.2 Improve Notify Assignees Dialog

**Current Issues:**
- No loading state while fetching assignees
- No empty state message
- Doesn't show which assignees were already notified

**Improvements:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Notify Assignees                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Loading assignees...  [Spinner]                                │
│                                                                 │
│  OR                                                             │
│                                                                 │
│  Select team members to notify:                                 │
│  ☐ Sarah Johnson (Client Manager)                               │
│  ☐ Mike Smith (Bookkeeper)                                      │
│                                                                 │
│  Custom Message:                                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Please review the client's query responses.                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  [Cancel]                              [Send Notifications]     │
└─────────────────────────────────────────────────────────────────┘
```

**Estimated Effort:** 2-3 hours

---

## Stage 6: UI/UX Enhancements (Priority: Low)

### 6.1 Larger Kanban Modal

**Current State:** The Messages modal is 80vw x 80vh which may feel cramped for the Queries tab with all its functionality.

**Proposed Changes:**
1. Increase modal size when Queries tab is active:
   - Width: 90vw (max 1400px)
   - Height: 85vh
2. Add responsive breakpoints for smaller screens
3. Ensure scrollable areas work correctly

**Estimated Effort:** 2-3 hours

---

### 6.2 Show Grouped Query Indicator in Table

**Visual indicator for grouped queries:**
```
┌───┬──────────┬────────────────────────┬──────────┬───────┐
│ ☐ │ Date     │ Description            │ Amount   │ Group │
├───┼──────────┼────────────────────────┼──────────┼───────┤
│ ☐ │ 15 Nov   │ Barclays Bank Interest │ £12.50   │ 📦 B  │
│ ☐ │ 18 Nov   │ Barclays Bank Fee      │ £15.00   │ 📦 B  │
│ ☐ │ 22 Nov   │ Amazon Prime           │ £9.99    │ 📦 A  │
│ ☐ │ 25 Nov   │ Office Supplies        │ £45.00   │  -    │
└───┴──────────┴────────────────────────┴──────────┴───────┘

Legend: 📦 B = Barclays group, 📦 A = Amazon group
```

**Estimated Effort:** 2-3 hours

---

## Implementation Timeline

| Stage | Description | Priority | Estimated Hours | Week |
|-------|-------------|----------|-----------------|------|
| 1.1 | Fix Notify button | Critical | 2-4 | Week 1 |
| 1.2 | Fix Cancel All in Kanban | Critical | 2-4 | Week 1 |
| 2.1 | Description search filter | High | 3-4 | Week 1 |
| 2.2 | Money In/Out filter | High | 1-2 | Week 1 |
| 3.1 | Database schema for groups | High | 2-3 | Week 2 |
| 3.2 | Manual grouping feature | High | 8-10 | Week 2 |
| 3.3 | Grouped client view | High | 10-12 | Week 3 |
| 3.4 | Edit/remove from groups | High | 6-8 | Week 3 |
| 4.1 | Auto-group algorithm | Medium | 6-8 | Week 4 |
| 4.2 | Auto-group UI | Medium | 8-10 | Week 4 |
| 5.1 | Notify on client response | Medium | 6-8 | Week 5 |
| 5.2 | Improve notify dialog | Medium | 2-3 | Week 5 |
| 6.1 | Larger Kanban modal | Low | 2-3 | Week 5 |
| 6.2 | Group indicator in table | Low | 2-3 | Week 5 |

**Total Estimated Effort:** 62-82 hours (approximately 2-3 weeks of focused development)

---

## Technical Dependencies

1. **Database Migration:** Required for Stage 3 (query groups)
2. **Object Storage:** Already configured for attachments
3. **Email Service:** Already configured (SendGrid)
4. **Notification System:** Existing infrastructure can be extended

---

## Testing Considerations

### Unit Tests
- Auto-group algorithm edge cases
- Group CRUD operations
- Filter logic

### Integration Tests
- End-to-end grouping flow
- Client response for grouped queries
- Notification delivery

### Manual Testing Scenarios
1. Create group, send to client, client responds
2. Auto-group suggestions with various data patterns
3. Remove queries from group, re-add
4. Cancel all reminders from Kanban modal
5. Notify assignees button with various project configurations

---

## Rollback Plan

Each stage is designed to be independently deployable. If issues arise:

1. **Database changes:** Migrations can be reverted (groupId column allows NULL)
2. **UI changes:** Feature flags can disable new functionality
3. **Algorithm changes:** Auto-group is optional, manual grouping remains available

---

## Success Metrics

1. **Reduction in queries sent to client:** Grouped queries should reduce the number of individual items clients need to respond to
2. **Staff efficiency:** Time to create and manage query groups
3. **Client response rate:** Monitor if grouped queries improve response rates
4. **Bug fix validation:** Notify button and Cancel All button work consistently

---

## Open Questions

1. Should grouped queries share a single VAT toggle or maintain individual toggles?
2. Should auto-group run automatically when importing bulk queries?
3. Should there be a maximum number of queries per group?
4. Should clients be able to respond to individual queries within a group, or only to the group as a whole?

---

## Appendix: File Changes Required

### New Files
- `shared/schema/queries/groups.ts` - Query groups schema
- `server/storage/queries/queryGroupStorage.ts` - Group storage operations
- `client/src/components/queries/QueryGroupDialog.tsx` - Create/edit group UI
- `client/src/components/queries/AutoGroupReview.tsx` - Auto-group review UI
- `client/src/components/queries/ManageGroupsPanel.tsx` - Groups management

### Modified Files
- `shared/schema/queries/tables.ts` - Add queryGroups table, groupId column
- `server/routes/queries.ts` - Add group-related endpoints
- `client/src/components/queries/QueriesTab.tsx` - Add filters, grouping UI
- `client/src/pages/query-response.tsx` - Handle grouped queries
- `client/src/components/queries/ScheduledRemindersPanel.tsx` - Fix cancel button
- `client/src/components/messages-modal.tsx` - Increase modal size
