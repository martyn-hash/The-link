# AI Magic Assistant - Implementation Plan

## Overview

The AI Magic Assistant is a floating conversational interface that allows users to interact with The Link CRM system using natural language (voice or text). The assistant leverages OpenAI's function-calling API to understand user intent, extract structured data, and pre-populate forms for user confirmation.

**Core Principle:** The AI never commits data directly. It always presents a pre-filled form/modal for user confirmation.

---

## Stage 1: Foundation & UI Components

### 1.1 Floating AI Button
- **Position:** Bottom-left corner (to avoid conflict with toast notifications in bottom-right)
- **Design:** Circular button with subtle glow/pulse animation
- **Icon:** Sparkles or Magic Wand icon from lucide-react
- **States:** Default, hover, active (chat open), processing
- **Z-index:** High enough to float above all content but below modals

### 1.2 Chat Panel
- **Position:** Slides up from bottom-left when button clicked
- **Size:** ~400px wide, ~500px tall (responsive on mobile)
- **Components:**
  - Header with title and close button
  - Info button (ℹ️) showing command capabilities
  - Message history (scrollable)
  - Input area with:
    - Text input field
    - Voice recording button (microphone icon)
    - Send button
  - Typing indicator for AI responses

### 1.3 Voice Input
- Use Web Speech API (`webkitSpeechRecognition`)
- Visual feedback: Recording indicator with waveform/pulse
- Auto-stop after silence detection
- Transcribed text appears in input field before sending
- Fallback message if browser doesn't support Speech API

### 1.4 Info/Help Modal
- Triggered by (ℹ️) button in chat header
- Categories of available commands:
  - **Create:** Reminders, Tasks, Emails, SMS
  - **View:** Tasks, Reminders, Projects (by type, assignee, status)
  - **Navigate:** Go to client, person, project
  - **Search:** Find clients, people
- Example phrases for each category

---

## Stage 2: OpenAI Integration

### 2.1 Backend API Route
- **Endpoint:** `POST /api/ai/chat`
- **Request body:**
  ```typescript
  {
    message: string;
    conversationHistory: { role: 'user' | 'assistant', content: string }[];
    context: {
      currentUserId: string;
      currentUserName: string;
      timezone: 'Europe/London'; // Always UK time
    }
  }
  ```

### 2.2 Function Definitions (Command Catalog)
OpenAI function-calling works by defining available "functions" (commands). The AI matches user intent to these functions and extracts parameters.

```typescript
const functions = [
  {
    name: "create_reminder",
    description: "Create a quick reminder for the user. Use when user wants to be reminded of something.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Brief title of the reminder" },
        details: { type: "string", description: "Additional details (optional)" },
        dateTime: { type: "string", description: "ISO datetime for the reminder (UK timezone)" },
        clientName: { type: "string", description: "Client name to link (optional)" }
      },
      required: ["title"]
    }
  },
  {
    name: "create_task",
    description: "Create a full internal task with assignee, priority, and due date.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        assigneeName: { type: "string", description: "Name of team member to assign to" },
        dueDate: { type: "string", description: "ISO date for due date" },
        priority: { type: "string", enum: ["low", "medium", "high"] },
        clientName: { type: "string", description: "Client name to link (optional)" }
      },
      required: ["title", "dueDate"]
    }
  },
  {
    name: "send_email",
    description: "Compose an email to a client or contact",
    parameters: {
      type: "object",
      properties: {
        recipientName: { type: "string", description: "Name of person to email" },
        clientName: { type: "string", description: "Client the person belongs to" },
        subject: { type: "string" },
        body: { type: "string" }
      },
      required: ["recipientName"]
    }
  },
  {
    name: "send_sms",
    description: "Send an SMS text message to a client contact",
    parameters: {
      type: "object",
      properties: {
        recipientName: { type: "string" },
        clientName: { type: "string" },
        message: { type: "string" }
      },
      required: ["recipientName", "message"]
    }
  },
  {
    name: "show_tasks",
    description: "Display a list of tasks, optionally filtered",
    parameters: {
      type: "object",
      properties: {
        assigneeName: { type: "string", description: "Filter by assignee name, 'me' for current user" },
        status: { type: "string", enum: ["open", "in_progress", "completed", "all"] },
        clientName: { type: "string" },
        includeReminders: { type: "boolean", description: "Include quick reminders in results" }
      }
    }
  },
  {
    name: "show_reminders",
    description: "Display a list of quick reminders for a user",
    parameters: {
      type: "object",
      properties: {
        assigneeName: { type: "string", description: "'me' for current user or team member name" },
        timeframe: { type: "string", enum: ["today", "this_week", "overdue", "upcoming", "all"] }
      }
    }
  },
  {
    name: "show_projects",
    description: "Display projects, optionally filtered by type, assignee, or status",
    parameters: {
      type: "object",
      properties: {
        projectTypeName: { type: "string", description: "e.g., 'VAT', 'Bookkeeping', 'Payroll'" },
        assigneeName: { type: "string", description: "'me' for current user" },
        clientName: { type: "string" },
        status: { type: "string", description: "Kanban stage name" },
        timeframe: { type: "string", enum: ["overdue", "due_this_week", "due_this_month"] }
      }
    }
  },
  {
    name: "navigate_to_client",
    description: "Open a client's detail page",
    parameters: {
      type: "object",
      properties: {
        clientName: { type: "string", description: "Name of the client to navigate to" }
      },
      required: ["clientName"]
    }
  },
  {
    name: "navigate_to_person",
    description: "Open a person's detail page",
    parameters: {
      type: "object",
      properties: {
        personName: { type: "string" },
        clientName: { type: "string", description: "Helps narrow down if multiple people with same name" }
      },
      required: ["personName"]
    }
  },
  {
    name: "search_clients",
    description: "Search for clients by name or criteria",
    parameters: {
      type: "object",
      properties: {
        searchTerm: { type: "string" }
      },
      required: ["searchTerm"]
    }
  },
  {
    name: "ask_clarification",
    description: "When the user's intent is unclear, ask for clarification",
    parameters: {
      type: "object",
      properties: {
        question: { type: "string" },
        suggestedCategories: { 
          type: "array", 
          items: { type: "string" },
          description: "Suggested action categories to help user"
        }
      },
      required: ["question"]
    }
  },
  {
    name: "request_missing_info",
    description: "When intent is clear but required info is missing",
    parameters: {
      type: "object",
      properties: {
        missingField: { type: "string" },
        question: { type: "string" }
      },
      required: ["missingField", "question"]
    }
  }
];
```

### 2.3 System Prompt
```text
You are an AI assistant for The Link, a CRM system for accounting firms. You help users create reminders, tasks, send emails/SMS, and navigate to data.

Current user: {{userName}}
Current date/time: {{currentDateTime}} (UK timezone)

Guidelines:
1. Always use UK timezone for dates and times
2. When user says "my" or "me", it refers to the current user
3. Parse natural language dates: "tomorrow", "next Wednesday", "in 2 hours"
4. If information is missing, use request_missing_info to ask for it
5. If intent is completely unclear, use ask_clarification with helpful categories
6. Be concise and friendly in responses
7. For ambiguous names, include what you understood so the system can offer matches

Remember: You cannot access the database directly. Return structured data for the system to process.
```

### 2.4 Response Handling
The API returns one of:
1. **Function call** - Intent recognized, data extracted
2. **Clarification request** - Need more info from user
3. **Plain message** - Conversational response (for greetings, help requests)

---

## Stage 3: Fuzzy Matching Service

### 3.1 Purpose
Resolve natural language names to database entities with confidence scoring.

### 3.2 Implementation
```typescript
interface MatchResult<T> {
  entity: T;
  confidence: number; // 0-1
  matchedOn: string; // which field matched
}

interface MatcherService {
  findClients(searchTerm: string): Promise<MatchResult<Client>[]>;
  findPeople(searchTerm: string, clientId?: string): Promise<MatchResult<Person>[]>;
  findUsers(searchTerm: string): Promise<MatchResult<User>[]>;
  findProjectTypes(searchTerm: string): Promise<MatchResult<ProjectType>[]>;
}
```

### 3.3 Matching Algorithm
1. Exact match (confidence: 1.0)
2. Case-insensitive exact match (confidence: 0.95)
3. Starts with (confidence: 0.85)
4. Contains (confidence: 0.7)
5. Levenshtein distance < 3 (confidence: 0.6-0.8)
6. Trigram similarity > 0.5 (confidence: 0.5-0.7)

### 3.4 Threshold Behavior
- Confidence >= 0.85: Auto-select, no confirmation needed
- Confidence 0.5-0.85: Show disambiguation options
- Confidence < 0.5: "No matches found, please try another search"

---

## Stage 4: Context Memory (Conversation State)

### 4.1 Session Context
Store conversation context to handle follow-up references:

```typescript
interface ConversationContext {
  lastMentionedClient?: { id: string; name: string };
  lastMentionedPerson?: { id: string; name: string };
  lastMentionedUser?: { id: string; name: string };
  lastAction?: string;
  conversationHistory: Message[];
}
```

### 4.2 Pronoun Resolution
- "Send them an email" → Uses lastMentionedPerson
- "Show their projects" → Uses lastMentionedClient
- "Assign it to Harry" → Uses lastAction context

---

## Stage 5: UI Modals & Forms

### 5.1 Form Pre-population Modals
Reuse existing dialogs where possible:
- **Reminder:** `CreateReminderDialog` - pre-fill title, details, dateTime, clientId
- **Task:** `CreateTaskDialog` - pre-fill title, description, assignedTo, dueDate, priority
- **Email:** `EmailDialog` - pre-fill recipient, subject, body
- **SMS:** `SMSDialog` - pre-fill recipient, message

### 5.2 Disambiguation Modal
When fuzzy matching returns multiple candidates:
- Show list of options with match confidence
- Allow user to select correct one
- Option to search manually
- "None of these" to cancel

### 5.3 Data Viewer Modal (for "show me")
- Near full-screen modal
- Tabs/filters for the data type
- Quick actions on items (edit, navigate)
- Close returns to chat

### 5.4 Navigation Actions
For "take me to" or "show me" a specific entity:
- Close chat panel
- Navigate using wouter's `useLocation`
- Show brief toast confirmation

---

## Stage 6: Voice Experience

### 6.1 Web Speech API Integration
```typescript
const recognition = new webkitSpeechRecognition();
recognition.continuous = false;
recognition.interimResults = true;
recognition.lang = 'en-GB'; // UK English

recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  // Show interim results in input
  // On final result, auto-send or allow editing
};
```

### 6.2 Voice UX
- Hold mic button to record (or tap to toggle)
- Show live transcription
- Confirm before sending (brief pause)
- Cancel by tapping elsewhere

### 6.3 Text-to-Speech Response (Optional, Future)
- Read AI responses aloud
- Toggle on/off in settings

---

## Stage 7: Error Handling & Edge Cases

### 7.1 API Failures
- OpenAI timeout/error: "I'm having trouble thinking right now. Please try again."
- Rate limiting: Queue and retry with backoff
- Network error: Offline indicator, retry button

### 7.2 No Results
- Client not found: "I couldn't find a client matching 'X'. Would you like to search again?"
- No tasks: "You don't have any open tasks right now!"

### 7.3 Permission Errors
- User tries to access data they can't see: "I can't access that information."

### 7.4 Voice Not Supported
- Browser doesn't support Web Speech: Show message, hide mic button

---

## Stage 8: Polish & Delight

### 8.1 Animations
- Chat panel slide in/out with spring physics (framer-motion)
- Messages fade in with slight upward motion
- Typing indicator with bouncing dots
- Success confirmation with checkmark animation
- Optional: confetti on first successful action

### 8.2 Sound Effects (Optional)
- Subtle "pop" on message send
- Success chime on action completion
- Mic activation beep

### 8.3 Keyboard Shortcuts
- `Cmd/Ctrl + K` to open AI chat (like Spotlight)
- `Escape` to close
- `Enter` to send (Shift+Enter for newline)

### 8.4 Smart Suggestions
- After idle in chat: Show suggested commands as chips
- Based on current page context (e.g., on client page, suggest "Create reminder for this client")

---

## Implementation Status

### Phase 1: Core UI (Stage 1) ✅ COMPLETE
- [x] 1.1 Create `AIMagicButton` component - Floating button, bottom-left, with pulse animation
- [x] 1.2 Create `AIMagicChatPanel` component - Side panel with message history, input, typing indicator
- [x] 1.3 Create `AIMagicHelpModal` showing capabilities - Command categories with example phrases
- [x] 1.4 Add to App.tsx (only for authenticated staff users)

### Phase 2: OpenAI Backend (Stage 2) ✅ COMPLETE
- [x] 2.1 Create `/api/ai/chat` endpoint - POST with message and conversation history
- [x] 2.2 Define function catalog - All 11 functions defined (create_reminder, create_task, send_email, send_sms, show_tasks, show_reminders, navigate_to_client, navigate_to_person, search_clients, ask_clarification, request_missing_info)
- [x] 2.3 Implement conversation handling with basic memory - Conversation history passed between calls
- [x] 2.4 Add proper error handling - Validation, API errors, user-friendly messages

### Phase 3: Fuzzy Matching (Stage 3) ⚠️ PARTIAL
- [ ] 3.1 Create `FuzzyMatcherService` with Levenshtein/trigram - NOT STARTED
- [x] 3.2 Basic client/user matching - Simple string includes() matching implemented in ActionCards
- [x] 3.3 Exact match direct navigation - SearchClientsActionCard navigates directly to client if exact/close match found
- [ ] 3.4 Create disambiguation UI component - NOT STARTED (no multiple match handling)
- [ ] 3.5 Confidence scoring and threshold behavior - NOT STARTED

### Phase 4: Action Execution (Stage 5) ✅ COMPLETE
- [x] 4.1 Wire up reminder creation - Custom inline form with type-to-search client/assignee, auto-close on success
- [x] 4.2 Wire up task creation - Custom inline form with priority, assignee, client selection
- [x] 4.3 Wire up email composition - Form with SearchableSelect for person, connects to Microsoft Graph API
- [x] 4.4 Wire up SMS composition - Form with SearchableSelect for person, connects to VoodooSMS API
- [x] 4.5 Show tasks/reminders - Direct navigation to tasks/reminders tabs (auto-navigates after 400ms)
- [x] 4.6 Implement navigation actions - Navigate to client/person detail pages
- [x] 4.7 Search clients action - Auto-navigates to client if exact match, otherwise shows search results
- [x] 4.8 Full email/SMS actual sending integration - Connected via /api/email/send and /api/sms/send

### Phase 5: Voice Input (Stage 6) ✅ COMPLETE
- [x] 5.1 Implement Web Speech API integration - webkitSpeechRecognition with en-GB, continuous mode
- [x] 5.2 Add visual recording feedback - Recording state indicator, live transcription
- [x] 5.3 Handle browser compatibility - voiceSupported check, hide mic if unsupported
- [x] 5.4 Error handling with toast notifications - Mic permission, network errors handled gracefully
- [x] 5.5 Auto-stop after final result - Stops recording 500ms after speech ends

### Phase 6: Context & Memory (Stage 4) ✅ COMPLETE
- [x] 6.1 Implement conversation context tracking - Tracks lastMentionedClient, lastMentionedPerson, lastMentionedUser, lastAction
- [x] 6.2 Add pronoun resolution - System prompt updated to resolve "them", "they", "this client" using context
- [x] 6.3 Test multi-turn conversations - Context passed to backend for each request

### Phase 7: Polish (Stage 8) ✅ COMPLETE
- [x] 7.1 Add animations and transitions - Framer Motion slide in/out, message animations
- [x] 7.2 Implement keyboard shortcuts - Cmd/Ctrl+K to open, Escape to close
- [x] 7.3 Add smart suggestions - Contextual suggestion chips based on current page and conversation context
- [x] 7.4 Auto-close panel after success - Implemented with 500ms delay

---

## What's Left To Do (Priority Order)

### High Priority - Core Functionality Gaps
1. ~~**Email/SMS Actual Sending**~~ ✅ DONE - Connected to Microsoft Graph API and VoodooSMS API
2. ~~**Fuzzy Matching Service**~~ ✅ DONE - Levenshtein distance algorithm with confidence scoring, abbreviation matching, word matching
3. ~~**Disambiguation UI**~~ ✅ DONE - AIMagicDisambiguation component shows when multiple matches have similar confidence

### Medium Priority - UX Improvements  
4. ~~**Keyboard Shortcut (Cmd+K)**~~ ✅ DONE - Opens/closes AI panel
5. ~~**Conversation Context Memory**~~ ✅ DONE - Tracks last mentioned client/person/user for pronoun resolution
6. ~~**Smart Suggestions**~~ ✅ DONE - Contextual command chips based on current page and conversation context

### Lower Priority - Nice to Have
7. **Sound Effects** - Subtle audio feedback
8. **TTS Response Reading** - Optional voice responses
9. **Offline Mode** - Queue commands when offline

### Fuzzy Matching Details
The fuzzy matching system uses multiple strategies:
- **Exact match** (1.0 confidence): Name matches exactly
- **Abbreviation** (0.95): "ABC" matches "ABC Limited" or initials match
- **Starts with** (0.9): Name starts with search term
- **Word boundary** (0.8): Search term matches a complete word
- **Contains** (0.7): Search term appears anywhere in name
- **Word match** (0.65): Any word in name starts with search term
- **Levenshtein fuzzy** (0.4-0.6): Typo tolerance using edit distance (>70% similarity)

Disambiguation thresholds:
- HIGH (≥0.9): Proceed automatically
- MEDIUM (≥0.7): May need confirmation
- LOW (≥0.5): Likely needs disambiguation
- MINIMUM (≥0.3): Included in results but very low confidence

---

## Current Files

### Implemented
- `client/src/components/ai-magic/AIMagicButton.tsx` ✅
- `client/src/components/ai-magic/AIMagicChatPanel.tsx` ✅
- `client/src/components/ai-magic/AIMagicHelpModal.tsx` ✅
- `client/src/components/ai-magic/AIMagicActionCards.tsx` ✅ (replaces planned DataViewer)
- `client/src/components/ai-magic/AIMagicDisambiguation.tsx` ✅ (shows when multiple matches found)
- `client/src/components/ai-magic/types.ts` ✅
- `client/src/components/ai-magic/index.ts` ✅
- `server/routes/ai.ts` ✅
- `server/services/ai-magic-service.ts` ✅ (includes Levenshtein fuzzy matching)

### Not Implemented (Intentionally Inline)
- `client/src/components/ai-magic/hooks/useAIChat.ts` - Logic is inline in ChatPanel
- `client/src/components/ai-magic/hooks/useVoiceInput.ts` - Logic is inline in ChatPanel
- `server/services/fuzzy-matcher.ts` - Fuzzy matching now inline in ai-magic-service.ts

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| AI Model | GPT-4o-mini | Already used in system, cost-effective |
| State Management | React state + context | Simple, no need for Redux |
| Voice API | Web Speech API | Native, no external dependencies |
| Animations | Framer Motion | Already in project |
| Date Parsing | date-fns + AI | AI handles natural language, date-fns for formatting |

---

## API Keys & Environment

- `OPENAI_API_KEY` - Already configured in system
- No additional environment variables needed

---

## Files to Create/Modify

### New Files
- `client/src/components/ai-magic/AIMagicButton.tsx`
- `client/src/components/ai-magic/AIMagicChatPanel.tsx`
- `client/src/components/ai-magic/AIMagicHelpModal.tsx`
- `client/src/components/ai-magic/AIMagicDataViewer.tsx`
- `client/src/components/ai-magic/AIMagicDisambiguation.tsx`
- `client/src/components/ai-magic/hooks/useAIChat.ts`
- `client/src/components/ai-magic/hooks/useVoiceInput.ts`
- `client/src/components/ai-magic/types.ts`
- `server/routes/ai.ts`
- `server/services/ai-assistant.ts`
- `server/services/fuzzy-matcher.ts`

### Files to Modify
- `client/src/App.tsx` - Add AIMagicButton to authenticated routes
- `server/routes.ts` - Register AI routes

---

## Success Metrics

1. **Speed:** Response time < 3 seconds for most commands
2. **Accuracy:** 90%+ correct intent recognition on common commands
3. **Completion Rate:** 80%+ of started conversations result in action
4. **User Adoption:** Track usage in first month

---

## Future Enhancements (Post-MVP)

1. **Project scheduling/benching** - Once confidence is high
2. **Batch operations** - "Complete all my overdue reminders"
3. **Custom commands** - Let users define shortcuts
4. **Learning from corrections** - Improve matching over time
5. **Voice responses** - Text-to-speech for hands-free use
6. **Mobile optimization** - Full-screen chat on small devices
7. **Offline mode** - Queue commands when offline
