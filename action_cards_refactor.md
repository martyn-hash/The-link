# AIMagicActionCards.tsx Refactoring Plan

## Current State Analysis

**File:** `client/src/components/ai-magic/AIMagicActionCards.tsx`
**Total Lines:** 3,067 lines
**Status:** Monolithic component with mixed concerns

### Problems Identified

1. **Single File Overload**
   - 20+ sub-components embedded in one file
   - 3,000+ lines making navigation and maintenance difficult
   
2. **Mixed Concerns**
   - UI rendering mixed with API calls
   - Business logic (matching, validation) embedded in components
   - Form handling spread across multiple card components
   
3. **Embedded Reusable Components**
   - `SearchableSelect` (lines 53-157, ~105 lines) - Generic searchable dropdown
   - `RecipientSelector` (lines 175-386, ~210 lines) - Person search with contact validation
   - Helper function `matchPersonWithClientContext` (lines 1198-1273)
   
4. **Long Action Card Components**
   - `ReminderActionCard` (~290 lines) - Complex state management + form + mutation
   - `TaskActionCard` (~290 lines) - Similar complexity
   - `EmailActionCard` (~200 lines) - Dialog integration + matching
   - `SmsActionCard` (~225 lines) - Similar to EmailActionCard
   
5. **Duplicated Patterns**
   - Similar matching logic in Email, SMS, Phone cards
   - Repeated motion wrapper + gradient styling patterns
   - Similar dismiss/complete button patterns

---

## Refactoring Strategy

### Guiding Principles

1. **Incremental Approach** - Each stage produces working code
2. **Preserve Behavior** - No functional changes during refactor
3. **Test After Each Stage** - Verify all functionality works
4. **Minimize Risk** - Extract most reusable pieces first

---

## Stage 1: Extract Shared UI Components

**Goal:** Extract generic, reusable UI components that have no business logic dependencies.

### 1.1 Create SearchableSelect Component

**New File:** `client/src/components/ai-magic/SearchableSelect.tsx`

**Extract From:** Lines 53-157 of current file

**Interface:**
```typescript
interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: { id: string; name: string }[];
  placeholder: string;
  suggestedName?: string;
  icon?: JSX.Element;
  testId?: string;
}
```

**Dependencies:**
- React hooks (useState, useEffect, useRef)
- `@/components/ui/input`
- `@/lib/utils` (cn)

### 1.2 Create RecipientSelector Component

**New File:** `client/src/components/ai-magic/RecipientSelector.tsx`

**Extract From:** Lines 159-386 of current file

**Interface:**
```typescript
interface RecipientSelectorProps {
  matchedPerson: { 
    id: string; 
    firstName: string | null; 
    lastName: string | null; 
    email?: string | null; 
    telephone?: string | null 
  } | null;
  matchedClientName: string;
  matchConfidence: number;
  originalName: string;
  contactType: 'email' | 'mobile';
  onPersonChange: (person: PersonSelection) => void;
}
```

**Dependencies:**
- React hooks, useQuery
- UI components (Input, Button)
- lucide-react icons

### 1.3 Create ActionCardWrapper Component

**New File:** `client/src/components/ai-magic/ActionCardWrapper.tsx`

**Purpose:** Standardize the motion wrapper and gradient patterns used by all cards.

**Interface:**
```typescript
interface ActionCardWrapperProps {
  children: React.ReactNode;
  colorScheme: 'amber' | 'green' | 'sky' | 'purple' | 'cyan' | 'teal' | 'red';
  testId: string;
}
```

**Benefits:**
- Consistent animation behavior
- Centralized styling
- Easier theme updates

### Stage 1 Success Criteria

- [ ] SearchableSelect works identically in ReminderActionCard and TaskActionCard
- [ ] RecipientSelector works identically in EmailActionCard and SmsActionCard
- [ ] ActionCardWrapper renders all existing cards without visual changes
- [ ] All existing data-testid attributes preserved
- [ ] No console errors or warnings

### Stage 1 Testing

1. Navigate to root page: `/`
2. Log in with: `jamsplan1@gmail.com` / `admin123`
3. Open AI Magic chat panel
4. Test: "Remind me to call John tomorrow at 2pm"
   - Verify reminder card appears with correct styling
   - Verify assignee dropdown is searchable
5. Test: "Send email to [any contact name]"
   - Verify recipient selector shows match or search mode
   - Verify "Change" button works
6. Test: "Create a task for [staff member]"
   - Verify task card appears
   - Verify project/client dropdowns work

---

## Stage 2: Extract Action Handlers to Custom Hook

**Goal:** Separate business logic and API mutations from UI components.

### 2.1 Create useAIMagicActions Hook

**New File:** `client/src/hooks/useAIMagicActions.ts`

**Extract:**
- All `useMutation` definitions from card components
- Common validation logic
- Cache invalidation patterns

**Interface:**
```typescript
interface UseAIMagicActionsReturn {
  // Reminder actions
  createReminder: UseMutationResult<...>;
  
  // Task actions  
  createTask: UseMutationResult<...>;
  
  // Project actions
  benchProject: UseMutationResult<...>;
  unbenchProject: UseMutationResult<...>;
  moveProjectStage: UseMutationResult<...>;
  
  // Helpers
  invalidateRelatedQueries: (type: 'task' | 'reminder' | 'project') => void;
}
```

**Benefits:**
- Mutations can be reused across components
- Easier testing of business logic
- Cleaner separation of concerns

### 2.2 Create usePersonMatcher Hook

**New File:** `client/src/hooks/usePersonMatcher.ts`

**Extract:**
- `matchPersonWithClientContext` function
- Person matching logic from EmailActionCard, SmsActionCard, PhoneNumberCard

**Interface:**
```typescript
interface UsePersonMatcherOptions {
  requireEmail?: boolean;
  requireMobile?: boolean;
}

interface UsePersonMatcherReturn {
  matchResult: MatchResult | null;
  isLoading: boolean;
  refetch: () => void;
}
```

### Stage 2 Success Criteria

- [ ] All mutations work identically through the hook
- [ ] Person matching produces same results as before
- [ ] Toast notifications display correctly
- [ ] Cache invalidation works properly after actions
- [ ] No duplicate API calls

### Stage 2 Testing

1. Log in with: `jamsplan1@gmail.com` / `admin123`
2. Test reminder creation:
   - Say: "Remind me to check invoices tomorrow at 10am"
   - Click confirm button
   - Verify reminder appears in reminders list
3. Test task creation:
   - Say: "Create a task for [staff member] to review documents"
   - Fill in details and confirm
   - Verify task appears in tasks list
4. Test email with person matching:
   - Say: "Email [person name] from [company name]"
   - Verify correct person matched or search works

---

## Stage 3: Split Card Types into Separate Files

**Goal:** Each action card becomes its own focused component file.

### 3.1 Create Cards Directory Structure

```
client/src/components/ai-magic/cards/
├── index.ts                    # Re-exports all cards
├── ReminderCard.tsx           # create_reminder
├── TaskCard.tsx               # create_task
├── EmailCard.tsx              # send_email
├── SmsCard.tsx                # send_sms
├── NavigationCard.tsx         # navigate_to_client, navigate_to_person
├── ShowTasksCard.tsx          # show_tasks
├── ShowRemindersCard.tsx      # show_reminders
├── SearchClientsCard.tsx      # search_clients
├── ProjectStatusCard.tsx      # get_project_status
├── BenchProjectCard.tsx       # bench_project
├── UnbenchProjectCard.tsx     # unbench_project
├── MoveStageCard.tsx          # move_project_stage
├── AnalyticsCard.tsx          # get_analytics
├── PhoneNumberCard.tsx        # get_phone_number
├── CallContactCard.tsx        # call_contact
├── QuickSmsCard.tsx           # quick_sms
├── TasksModalCard.tsx         # show_tasks_modal
└── UnknownActionCard.tsx      # fallback
```

### 3.2 Card Component Template

Each card file follows this pattern:

```typescript
// cards/ReminderCard.tsx
import { ActionCardWrapper } from '../ActionCardWrapper';
import { SearchableSelect } from '../SearchableSelect';
import { useAIMagicActions } from '@/hooks/useAIMagicActions';
import type { ActionCardProps } from '../types';

export function ReminderCard({ functionCall, onComplete, onDismiss }: ActionCardProps) {
  // Local state for form fields
  // Use shared hooks for mutations
  // Use ActionCardWrapper for consistent styling
}
```

### 3.3 Update Main ActionCard Dispatcher

**File:** `client/src/components/ai-magic/ActionCard.tsx`

```typescript
import * as Cards from './cards';

export function ActionCard({ functionCall, onComplete, onDismiss }: ActionCardProps) {
  const cardMap: Record<string, ComponentType<ActionCardProps>> = {
    'create_reminder': Cards.ReminderCard,
    'create_task': Cards.TaskCard,
    'send_email': Cards.EmailCard,
    // ... etc
  };
  
  const CardComponent = cardMap[functionCall.name] || Cards.UnknownActionCard;
  return <CardComponent {...props} />;
}
```

### 3.4 Update Types File

**File:** `client/src/components/ai-magic/types.ts`

Add:
```typescript
export interface ActionCardProps {
  functionCall: AIFunctionCall;
  onComplete: (success: boolean, message: string) => void;
  onDismiss: () => void;
}

export interface PersonSelection {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  telephone?: string;
  clientId: string;
  clientName: string;
}
```

### Stage 3 Success Criteria

- [ ] Each card type in its own file
- [ ] Main ActionCard dispatcher uses dynamic imports
- [ ] All 17 action types work correctly
- [ ] Code navigation is intuitive
- [ ] No circular dependencies
- [ ] Total file sizes reduced (no file over 300 lines)

### Stage 3 Testing

Full regression test of all AI Magic actions:

| Action | Test Command | Expected Behavior |
|--------|-------------|-------------------|
| create_reminder | "Remind me to call John tomorrow" | Reminder card with form |
| create_task | "Create task for Harry to review docs" | Task card with assignee picker |
| send_email | "Email Sarah at ABC Ltd" | Email card with recipient selector |
| send_sms | "Text John about the meeting" | SMS card with phone verification |
| navigate_to_client | "Go to ABC Ltd" | Auto-navigation to client page |
| navigate_to_person | "Open John Smith's profile" | Auto-navigation to person page |
| show_tasks | "Show my tasks" | Navigation to tasks page |
| show_reminders | "Show overdue reminders" | Navigation to reminders page |
| show_tasks_modal | "What are my tasks?" | Modal popup with tasks list |
| search_clients | "Find clients matching Victor" | Search results or navigation |
| get_project_status | "Status of ABC project" | Project status card |
| bench_project | "Bench the VAT return for ABC" | Bench confirmation card |
| unbench_project | "Unbench ABC's project" | Unbench confirmation card |
| move_project_stage | "Move ABC to next stage" | Stage selection card |
| get_analytics | "How many overdue projects?" | Analytics summary card |
| get_phone_number | "What's John's phone number?" | Phone number display card |
| call_contact | "Call John from ABC" | Initiates call action |
| quick_sms | "Quick text to John" | Quick SMS compose card |

---

## Stage 4: Final Cleanup and Optimization

**Goal:** Remove the original monolithic file and optimize.

### 4.1 Delete Original File

After all cards are extracted and tested:
- Delete `client/src/components/ai-magic/AIMagicActionCards.tsx`
- Update all imports to use new locations

### 4.2 Update Index Exports

**File:** `client/src/components/ai-magic/index.ts`

```typescript
export { ActionCard } from './ActionCard';
export { SearchableSelect } from './SearchableSelect';
export { RecipientSelector } from './RecipientSelector';
export { ActionCardWrapper } from './ActionCardWrapper';
export * from './types';
```

### 4.3 Code Quality Checks

- [ ] Run TypeScript compiler with strict mode
- [ ] Check for unused imports
- [ ] Verify all data-testid attributes present
- [ ] Confirm no duplicate code across card files
- [ ] Validate bundle size hasn't increased significantly

### Stage 4 Success Criteria

- [ ] Original 3,067 line file deleted
- [ ] No broken imports
- [ ] All tests pass
- [ ] Code coverage maintained or improved
- [ ] Each new file under 300 lines
- [ ] Clear separation of concerns

---

## Final Directory Structure

```
client/src/components/ai-magic/
├── index.ts
├── types.ts                    # Shared types and interfaces
├── ActionCard.tsx              # Main dispatcher (< 50 lines)
├── ActionCardWrapper.tsx       # Motion wrapper (< 50 lines)
├── SearchableSelect.tsx        # Reusable dropdown (< 120 lines)
├── RecipientSelector.tsx       # Person search (< 220 lines)
├── AIMagicButton.tsx           # (unchanged)
├── AIMagicChatPanel.tsx        # (unchanged)
├── AIMagicCallHandler.tsx      # (unchanged)
├── AIMagicDisambiguation.tsx   # (unchanged)
├── AIMagicHelpModal.tsx        # (unchanged)
├── MatcherDebugPanel.tsx       # (unchanged)
├── TasksRemindersModal.tsx     # (unchanged)
└── cards/
    ├── index.ts
    ├── ReminderCard.tsx        # (< 200 lines)
    ├── TaskCard.tsx            # (< 200 lines)
    ├── EmailCard.tsx           # (< 180 lines)
    ├── SmsCard.tsx             # (< 180 lines)
    ├── NavigationCard.tsx      # (< 80 lines)
    ├── ShowTasksCard.tsx       # (< 60 lines)
    ├── ShowRemindersCard.tsx   # (< 60 lines)
    ├── SearchClientsCard.tsx   # (< 100 lines)
    ├── ProjectStatusCard.tsx   # (< 150 lines)
    ├── BenchProjectCard.tsx    # (< 150 lines)
    ├── UnbenchProjectCard.tsx  # (< 150 lines)
    ├── MoveStageCard.tsx       # (< 200 lines)
    ├── AnalyticsCard.tsx       # (< 120 lines)
    ├── PhoneNumberCard.tsx     # (< 150 lines)
    ├── CallContactCard.tsx     # (< 120 lines)
    ├── QuickSmsCard.tsx        # (< 150 lines)
    ├── TasksModalCard.tsx      # (< 100 lines)
    └── UnknownActionCard.tsx   # (< 40 lines)

client/src/hooks/
├── useAIMagicActions.ts        # Action mutations (< 200 lines)
└── usePersonMatcher.ts         # Person matching (< 150 lines)
```

---

## Testing Guide

### Test Environment

- **URL:** Root page (`/`)
- **Credentials:** `jamsplan1@gmail.com` / `admin123`
- **Access:** AI Magic chat panel (magic wand button or keyboard shortcut)

### Test Execution Per Stage

After completing each stage:

1. **Clear browser cache** to ensure fresh load
2. **Log in** with test credentials
3. **Open AI Magic** chat panel
4. **Execute each test command** from the testing table
5. **Verify visual appearance** matches before refactor
6. **Verify functionality** (buttons, forms, navigation)
7. **Check console** for errors or warnings
8. **Test edge cases:**
   - Invalid/unknown person names
   - Missing data scenarios
   - Cancel/dismiss actions
   - Network error handling

### Regression Test Checklist

| Component | Test Action | Pass/Fail |
|-----------|-------------|-----------|
| SearchableSelect | Type to filter, select option | |
| SearchableSelect | Clear selection (None) | |
| RecipientSelector | Auto-match display | |
| RecipientSelector | Change button → search | |
| RecipientSelector | No match warning | |
| ReminderCard | Create with all fields | |
| ReminderCard | Edit mode toggle | |
| TaskCard | Create with assignee | |
| TaskCard | Project linking | |
| EmailCard | Open composer dialog | |
| SmsCard | Open SMS dialog | |
| NavigationCard | Auto-redirect | |
| All Cards | Dismiss button | |
| All Cards | Loading states | |
| All Cards | Error handling | |

---

## Risk Mitigation

### Rollback Plan

Each stage creates a working checkpoint. If issues arise:
1. Revert to previous working state
2. Identify specific failing component
3. Fix in isolation before re-integrating

### Common Pitfalls to Avoid

1. **Import cycles** - Be careful with shared types and hooks
2. **Lost state** - Ensure form state persists through re-renders
3. **Missing props** - TypeScript will catch most, but verify at runtime
4. **Toast context** - useToast must be within provider
5. **Query keys** - Maintain consistent cache key patterns

### Performance Considerations

- Lazy load card components where appropriate
- Memoize expensive matching computations
- Keep query key patterns for cache reuse

---

## Timeline Estimate

| Stage | Estimated Time | Dependencies |
|-------|----------------|--------------|
| Stage 1 | 2-3 hours | None |
| Stage 2 | 2-3 hours | Stage 1 |
| Stage 3 | 4-6 hours | Stage 1, 2 |
| Stage 4 | 1-2 hours | Stage 1, 2, 3 |

**Total: 9-14 hours**

---

## Summary

This refactoring plan transforms a 3,067-line monolithic component into a well-organized, maintainable codebase with:

- **~20 focused files** instead of 1 massive file
- **Clear separation** of UI, business logic, and state management
- **Reusable components** for common patterns
- **Consistent testing approach** for validation
- **Incremental delivery** with working code at each stage
