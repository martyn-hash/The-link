# Stage 6: Extract Communications Components - Detailed Planning Brief

**Status:** PLANNING  
**Created:** November 25, 2025  
**Estimated Effort:** 6-8 hours  
**Risk Level:** HIGH  

---

## Executive Summary

Stage 6 is the largest and most complex extraction phase, involving the `CommunicationsTimeline` component (1,235 lines) and `CallDialog` component (85 lines). The communications system integrates multiple data sources (communications, message threads, email threads), multiple communication channels (phone, SMS, email, instant messages), and uses several external components. This phase requires careful attention to:

1. **State lifting** - Multiple dialogs share clientPeople data
2. **Data flow** - Unified timeline merges 3 different data sources
3. **External dependencies** - Integration with RingCentral, TiptapEditor, external components
4. **Cache invalidation** - All mutations must properly refresh data

**Expected Reduction:** ~1,320 lines (31% of remaining 4,239 lines)  
**Target Post-Stage 6:** ~2,919 lines

---

## Current Component Analysis

### CommunicationsTimeline (Lines 117-1352)
**Total Lines:** 1,235 lines  
**Complexity:** Very High  

#### State Variables (17 total)
```typescript
// Dialog visibility states
const [isAddingCommunication, setIsAddingCommunication] = useState(false);
const [isSendingSMS, setIsSendingSMS] = useState(false);
const [isSendingEmail, setIsSendingEmail] = useState(false);
const [isCreatingMessage, setIsCreatingMessage] = useState(false);
const [isViewingCommunication, setIsViewingCommunication] = useState(false);
const [isCallingPerson, setIsCallingPerson] = useState(false);
const [emailThreadViewerOpen, setEmailThreadViewerOpen] = useState(false);

// Selection states
const [smsPersonId, setSmsPersonId] = useState<string | undefined>();
const [emailPersonId, setEmailPersonId] = useState<string | undefined>();
const [emailContent, setEmailContent] = useState<string>('');
const [callPersonId, setCallPersonId] = useState<string | undefined>();
const [callPhoneNumber, setCallPhoneNumber] = useState<string | undefined>();
const [selectedCommunication, setSelectedCommunication] = useState<CommunicationWithRelations | null>(null);
const [selectedEmailThreadId, setSelectedEmailThreadId] = useState<string | null>(null);

// Filter state
const [commTypeFilter, setCommTypeFilter] = useState<'all' | 'phone_call' | 'sms' | 'email' | 'message_thread' | 'note' | 'email_thread'>('all');

// Cache
const [projectCache, setProjectCache] = useState<Record<string, any>>({});
```

#### Data Queries (4 total)
| Query | Endpoint | Purpose |
|-------|----------|---------|
| `communications` | `/api/communications/client/{clientId}` | Log of all communications |
| `messageThreads` | `/api/internal/messages/threads/client/{clientId}` | Internal message threads |
| `emailThreadsData` | `/api/emails/client/{clientId}` | Microsoft Graph email threads |
| `clientPeople` | `/api/clients/{clientId}/people` | People for person selection dropdowns |

#### Mutations (4 total)
| Mutation | Endpoint | Purpose |
|----------|----------|---------|
| `addCommunicationMutation` | `POST /api/communications` | Log phone calls, notes |
| `sendSmsMutation` | `POST /api/sms/send` | Send SMS via VoodooSMS |
| `sendEmailMutation` | `POST /api/email/send` | Send email via Microsoft Graph |
| `createMessageThreadMutation` | `POST /api/internal/messages/threads` | Create instant message thread |

#### Helper Functions (3 total)
```typescript
function getIcon(type: string): JSX.Element       // Returns icon component for comm type
function getTypeColor(type: string): string       // Returns Tailwind classes for badge color
function getTypeLabel(type: string): string       // Returns display label for comm type
```

#### Data Transformation Logic
```typescript
// Unified timeline merging (lines 417-445)
const allItems = [
  ...(communications || []),
  ...(messageThreads || []).map(thread => ({ type: 'message_thread', ... })),
  ...(emailThreads || []).map(thread => ({ type: 'email_thread', ... })),
].sort((a, b) => new Date(b.loggedAt || b.createdAt) - new Date(a.loggedAt || a.createdAt));
```

### CallDialog (Lines 1355-1440)
**Total Lines:** 85 lines  
**Complexity:** Medium  

Self-contained dialog with:
- Person selection with phone number display
- RingCentral integration via `<RingCentralPhone>` component
- Cache invalidation on call complete

---

## Inline Dialog Inventory

| Dialog | Lines | Props Required | Dependencies |
|--------|-------|----------------|--------------|
| **Add Communication Modal** | ~120 | clientId, clientPeople, onSuccess | Form, mutations |
| **SMS Sending Dialog** | ~85 | clientId, clientPeople, onSuccess | sendSmsMutation |
| **Email Sending Dialog** | ~120 | clientId, clientPeople, user, onSuccess | TiptapEditor, sendEmailMutation |
| **View Communication Detail** | ~105 | selectedCommunication, isOpen, onClose | Helper functions |
| **Create Instant Message** | ~55 | clientId, onSuccess | createMessageThreadMutation |
| **Call Dialog (external)** | ~85 | clientId, personId, phoneNumber, isOpen, onClose | RingCentralPhone |

---

## Extraction Architecture

### Proposed File Structure
```
client/src/pages/client-detail/components/communications/
├── index.tsx                        # Re-exports all components
├── types.ts                         # Shared types for communications
├── helpers.ts                       # getIcon, getTypeColor, getTypeLabel
├── CommunicationsTimeline.tsx       # Main orchestrating component (~400 lines)
├── CommunicationFilters.tsx         # Filter buttons component (~100 lines)
├── CommunicationList.tsx            # Table/Card views (~200 lines)
└── dialogs/
    ├── index.tsx                    # Re-exports all dialogs
    ├── AddCommunicationDialog.tsx   # Add phone call/note (~150 lines)
    ├── SMSDialog.tsx                # Send SMS (~120 lines)
    ├── EmailDialog.tsx              # Send Email with TiptapEditor (~160 lines)
    ├── ViewCommunicationDialog.tsx  # View communication detail (~130 lines)
    ├── CreateMessageDialog.tsx      # Create instant message (~80 lines)
    └── CallDialog.tsx               # Make phone call (~100 lines)
```

### Component Boundaries

#### 1. helpers.ts (Extract First - No Dependencies)
```typescript
// Pure functions, no side effects
export function getIcon(type: string): JSX.Element;
export function getTypeColor(type: string): string;
export function getTypeLabel(type: string): string;
```

#### 2. types.ts
```typescript
export type CommunicationType = 'all' | 'phone_call' | 'sms' | 'email' | 'message_thread' | 'note' | 'email_thread';

export interface TimelineItem {
  id: string;
  type: string;
  loggedAt?: string | Date;
  createdAt?: string | Date;
  subject?: string | null;
  content?: string | null;
  user?: { firstName: string; lastName: string } | null;
  createdBy?: string | null;
  projectId?: string | null;
  messageCount?: number;
  unreadCount?: number;
  attachmentCount?: number;
  participants?: string[];
}

export interface DialogProps {
  clientId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export interface PersonOption {
  person: {
    id: string;
    firstName: string;
    lastName: string;
    fullName?: string;
    primaryPhone?: string;
    primaryEmail?: string;
  };
}
```

#### 3. Individual Dialogs
Each dialog receives minimal props:
- `clientId` - Required for API calls
- `isOpen` / `onClose` - Dialog state management
- `onSuccess` - Callback for parent to invalidate queries
- `clientPeople` - Passed down for person selection (avoid duplicate queries)

#### 4. CommunicationsTimeline (Orchestrator)
- Owns all state and queries
- Passes state setters and data to child dialogs
- Handles unified timeline data transformation
- Renders CommunicationFilters and CommunicationList

---

## Shared State & Data Flow

### State Ownership
```
CommunicationsTimeline (Parent)
├── Owns: All query data (communications, messageThreads, emailThreadsData, clientPeople)
├── Owns: All dialog visibility states
├── Owns: Filter state
├── Owns: Selected item states
│
├── CommunicationFilters
│   └── Receives: commTypeFilter, setCommTypeFilter, filteredCounts
│
├── CommunicationList
│   └── Receives: filteredItems, projectCache, event handlers
│
└── Dialogs (all receive via props)
    ├── AddCommunicationDialog: clientId, clientPeople, isOpen, onClose, onSuccess
    ├── SMSDialog: clientId, clientPeople, isOpen, onClose, onSuccess
    ├── EmailDialog: clientId, clientPeople, user, isOpen, onClose, onSuccess
    ├── ViewCommunicationDialog: communication, isOpen, onClose
    ├── CreateMessageDialog: clientId, isOpen, onClose, onSuccess
    └── CallDialog: clientId, personId, phoneNumber, isOpen, onClose
```

### Query Invalidation Pattern
Each dialog mutation should call `onSuccess` which triggers:
```typescript
// In CommunicationsTimeline
const handleRefresh = () => {
  queryClient.invalidateQueries({ queryKey: ['/api/communications/client', clientId] });
  queryClient.invalidateQueries({ queryKey: ['/api/internal/messages/threads/client', clientId] });
};
```

---

## Extraction Order (Dependency-Safe)

### Phase 6.1: Create Foundation (1 hour)
1. Create `components/communications/` directory
2. Create `types.ts` with shared interfaces
3. Create `helpers.ts` with getIcon, getTypeColor, getTypeLabel
4. Create `index.tsx` for re-exports
5. Create `dialogs/index.tsx` for dialog re-exports

### Phase 6.2: Extract Simple Dialogs (2 hours)
Order by complexity (simplest first):
1. **CreateMessageDialog** (~80 lines) - Simplest, minimal dependencies
2. **ViewCommunicationDialog** (~130 lines) - Read-only, uses helpers
3. **AddCommunicationDialog** (~150 lines) - Form with mutation

### Phase 6.3: Extract Complex Dialogs (2 hours)
4. **SMSDialog** (~120 lines) - Person selection, validation, mutation
5. **CallDialog** (~100 lines) - Already mostly self-contained, uses RingCentralPhone
6. **EmailDialog** (~160 lines) - Most complex, uses TiptapEditor, handles signatures

### Phase 6.4: Extract List Components (1.5 hours)
7. **CommunicationFilters** (~100 lines) - Filter button bar
8. **CommunicationList** (~200 lines) - Mobile cards + Desktop table

### Phase 6.5: Refactor Main Component (1.5 hours)
9. **CommunicationsTimeline** - Reduce to orchestrator role (~400 lines)
   - Keep query definitions
   - Keep data transformation logic
   - Import and compose child components
   - Wire up all event handlers

---

## Key Features to Preserve

### 1. Unified Timeline Display
- Merge 3 data sources (communications, message threads, email threads)
- Sort by most recent first
- Mobile card view vs desktop table view

### 2. Communication Type Filtering
- Filter buttons with counts
- Filter types: all, phone_call, sms, email, message_thread, note, email_thread

### 3. SMS Sending
- Person selection (required)
- Phone number validation
- API integration with VoodooSMS

### 4. Email Sending
- Person selection (required)
- Rich text editor (TiptapEditor)
- User email signature appending
- HTML content validation

### 5. Phone Calls (RingCentral)
- Person selection (optional)
- RingCentralPhone component integration
- Call logging to communications

### 6. Message Thread Creation
- Subject and initial message
- Navigation to message thread after creation

### 7. Email Thread Viewing
- Opens EmailThreadViewer modal
- Displays Microsoft Graph email threads

---

## External Component Dependencies

| Component | Source | Usage |
|-----------|--------|-------|
| `TiptapEditor` | `@/components/TiptapEditor` | Rich text editing in EmailDialog |
| `RingCentralPhone` | `@/components/ringcentral-phone` | Phone call integration |
| `EmailThreadViewer` | `@/components/EmailThreadViewer` | View email threads |
| `CommunicationCard` | `@/components/communication-card` | Mobile card view |

---

## Testing Strategy

### Browser Tests (6 tests)

#### Test 1: View Communications Tab
```
1. Login and navigate to client detail
2. Click Communications tab
3. Verify timeline loads with items
4. Verify filter buttons display with counts
```

#### Test 2: Add Communication (Note)
```
1. Click "Add Communication" button
2. Select type "Note"
3. Enter subject and content
4. Submit form
5. Verify new communication appears in timeline
```

#### Test 3: Send SMS
```
1. Click "Send SMS" button
2. Select a person with mobile number
3. Enter message
4. Verify SMS mutation triggered
5. Verify dialog closes
```

#### Test 4: Send Email
```
1. Click "Send Email" button
2. Select a person with email
3. Enter subject
4. Use TiptapEditor to enter content
5. Submit
6. Verify email mutation triggered
```

#### Test 5: Create Instant Message
```
1. Click "Instant Message" button
2. Enter subject and message
3. Submit
4. Verify redirect to messages page
```

#### Test 6: Make Call (if RingCentral available)
```
1. Click "Make Call" button
2. Select person
3. Verify RingCentralPhone component loads
4. Close dialog
```

---

## Risk Mitigation

### High Risk Areas

1. **TiptapEditor Integration**
   - Risk: Complex rich text handling, email content formatting
   - Mitigation: Keep all TiptapEditor logic in EmailDialog, test thoroughly

2. **RingCentral Integration**
   - Risk: External service dependency, call logging
   - Mitigation: Keep RingCentralPhone usage in CallDialog, preserve callback chain

3. **Email Signature Appending**
   - Risk: HTML content manipulation
   - Mitigation: Preserve exact signature logic from original

4. **Query Invalidation**
   - Risk: Multiple queries need refreshing after mutations
   - Mitigation: Use onSuccess callbacks consistently

### Medium Risk Areas

1. **Data Transformation Logic**
   - Risk: Unified timeline merging complexity
   - Mitigation: Keep in CommunicationsTimeline, test sort order

2. **Mobile vs Desktop Views**
   - Risk: Different rendering paths
   - Mitigation: Keep useIsMobile logic in CommunicationList

---

## Success Criteria

- [ ] All 6 dialogs extracted to `components/communications/dialogs/`
- [ ] Helpers extracted to `helpers.ts`
- [ ] Types defined in `types.ts`
- [ ] CommunicationFilters extracted
- [ ] CommunicationList extracted with mobile/desktop views
- [ ] CommunicationsTimeline reduced to orchestrator (~400 lines)
- [ ] All communication types display correctly
- [ ] Filter buttons work with correct counts
- [ ] Add Communication creates new entries
- [ ] SMS sending works with person validation
- [ ] Email sending works with TiptapEditor
- [ ] Instant Message creation and redirect works
- [ ] Call dialog opens with RingCentralPhone
- [ ] Email thread viewer opens correctly
- [ ] No duplicate function definitions in main file
- [ ] Cache invalidation works for all mutations

---

## Line Count Projections

| Component | Estimated Lines |
|-----------|-----------------|
| types.ts | ~50 |
| helpers.ts | ~60 |
| CreateMessageDialog | ~80 |
| ViewCommunicationDialog | ~130 |
| AddCommunicationDialog | ~150 |
| SMSDialog | ~120 |
| CallDialog | ~100 |
| EmailDialog | ~160 |
| CommunicationFilters | ~100 |
| CommunicationList | ~200 |
| CommunicationsTimeline | ~400 |
| index.tsx (2 files) | ~15 |
| **Total Extracted** | **~1,565** |
| **Net Reduction from Main** | **~1,320** |

---

## Dependencies on Previous Stages

- Uses `formatPersonName` from `./utils/formatters`
- Uses shared schema types from `@shared/schema`
- No dependencies on Stage 3-5 extracted components

---

## Post-Extraction Verification

1. Communications tab loads with all data types
2. All 7 filter buttons work
3. Add Communication (Note/Phone Call) works
4. Send SMS with person selection works
5. Send Email with TiptapEditor works
6. Create Instant Message works
7. Make Call dialog opens
8. View Communication Detail modal works
9. Email Thread Viewer opens
10. Mobile card view displays correctly
11. Desktop table view displays correctly
12. No console errors or TypeScript issues
