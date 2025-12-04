# AI Magic Assistant - Features & Testing Guide

This document describes all the features available in the AI Magic Assistant, how to test them, and known limitations.

---

## 1. Reminders

**Purpose:** Create personal reminders with optional client/project links.

### How to Test
| Test Case | What to Say | Expected Result |
|-----------|-------------|-----------------|
| Basic reminder | "Remind me to call John tomorrow" | Creates reminder for tomorrow |
| With time | "Remind me to submit VAT at 3pm" | Creates reminder with specific time |
| With client link | "Remind me about ABC Ltd next Monday" | Creates reminder linked to client |

### Known Limitations
- Requires a name/title for the reminder
- Date parsing may vary based on phrasing

---

## 2. Tasks

**Purpose:** Create internal tasks with assignees, types, and due dates.

### How to Test
| Test Case | What to Say | Expected Result |
|-----------|-------------|-----------------|
| Self-assigned task | "Create a task to review accounts" | Creates task assigned to you |
| Assign to team | "Create a task for Sarah to call the client" | Creates task assigned to Sarah |
| With client | "Create a follow-up task for ABC Ltd" | Creates task linked to client |
| With due date | "Create a task to file returns by Friday" | Creates task with due date |

### Known Limitations
- Team member matching is case-insensitive but must be close to actual name
- Task type must match existing types (e.g., "Follow Up", "Call", "Email")

---

## 3. Send Email

**Purpose:** Compose and send emails to people (related persons of clients).

### How to Test
| Test Case | What to Say | Expected Result |
|-----------|-------------|-----------------|
| Basic email | "Send an email to John Smith" | Opens email card with John selected |
| With client context | "Send an email to Mark from Monkey Access Limited" | Should match Mark at that client |
| With subject | "Email John about the VAT deadline" | Opens email with subject pre-filled |
| From client page | "Send an email to this client" | Should use current client context |

### Known Limitations
- **BUG:** Person matching doesn't include client name in search
- **BUG:** "This client" context not passed when on client page
- Currently uses simple form, not the full email dialog with rich text editor
- Requires person to have email address on file

---

## 4. Send SMS

**Purpose:** Send text messages to people with mobile numbers.

### How to Test
| Test Case | What to Say | Expected Result |
|-----------|-------------|-----------------|
| Basic SMS | "Text John Smith" | Opens SMS card |
| With message | "Send a text to Sarah saying we received the documents" | Opens with message pre-filled |

### Known Limitations
- Person must have mobile number on file
- Same matching limitations as email

---

## 5. Navigation - Find Client

**Purpose:** Navigate directly to a client's detail page.

### How to Test
| Test Case | What to Say | Expected Result |
|-----------|-------------|-----------------|
| Full name | "Take me to ABC Ltd" | Navigates to client page |
| Partial name | "Find Monkey Access" | Navigates to Monkey Access Limited |
| Search | "Search for clients named Smith" | Shows matching results |

### Known Limitations
- Fuzzy matching based on Levenshtein distance
- May ask for clarification if multiple matches

---

## 6. Navigation - Find Person

**Purpose:** Navigate to a person's detail page.

### How to Test
| Test Case | What to Say | Expected Result |
|-----------|-------------|-----------------|
| By name | "Find John Smith" | Navigates to person page |
| With client | "Take me to Mark at Monkey Access" | Should find the right person |

### Known Limitations
- May show disambiguation if multiple people share the name

---

## 7. Show Tasks

**Purpose:** View and filter your tasks.

### How to Test
| Test Case | What to Say | Expected Result |
|-----------|-------------|-----------------|
| My tasks | "Show me my tasks" | Navigates to task list filtered to you |
| Overdue | "Show overdue tasks" | Shows overdue tasks |
| Pending | "What tasks are pending" | Shows pending tasks |

---

## 8. Show Reminders

**Purpose:** View your upcoming reminders.

### How to Test
| Test Case | What to Say | Expected Result |
|-----------|-------------|-----------------|
| All reminders | "Show my reminders" | Opens reminder list |
| Today | "What reminders do I have today" | Shows today's reminders |
| Upcoming | "What's coming up this week" | Shows week's reminders |

---

## 9. Project Status (NEW)

**Purpose:** Check the status of a specific client's project.

### How to Test
| Test Case | What to Say | Expected Result |
|-----------|-------------|-----------------|
| By client name | "Status of ABC Ltd bookkeeping" | Shows project status card |
| Partial match | "Check VICTORIAM bookkeeping" | Finds and shows project |
| General query | "What's the status of Smith VAT" | Shows VAT project for Smith |

### Known Limitations
- Requires both client name and project type for best results
- Fuzzy matching helps with partial names

---

## 10. Bench Project (NEW)

**Purpose:** Move a project to the bench (temporarily suspend it).

### How to Test
| Test Case | What to Say | Expected Result |
|-----------|-------------|-----------------|
| Basic bench | "Bench ABC Ltd bookkeeping" | Opens bench confirmation card |
| With reason | "Bench Smith VAT for missing data" | Pre-selects missing_data reason |

### Known Limitations
- Must specify project clearly
- Cannot bench already-benched projects

---

## 11. Unbench Project (NEW)

**Purpose:** Remove a project from the bench.

### How to Test
| Test Case | What to Say | Expected Result |
|-----------|-------------|-----------------|
| Basic unbench | "Unbench ABC Ltd bookkeeping" | Opens unbench confirmation |
| With notes | "Take ABC Ltd off the bench, data received" | Includes notes |

### Known Limitations
- Project must currently be benched

---

## 12. Move Project Stage (NEW)

**Purpose:** Move a project to a different workflow stage.

### How to Test
| Test Case | What to Say | Expected Result |
|-----------|-------------|-----------------|
| Next stage | "Move ABC Ltd bookkeeping to next stage" | Opens stage selection |
| Specific stage | "Move Smith VAT to Final Review" | Pre-selects target stage |

### Known Limitations
- Requires selecting a change reason
- Some stages may require approval fields

---

## 13. Analytics (NEW)

**Purpose:** Get aggregate statistics about projects and workload.

### How to Test
| Test Case | What to Say | Expected Result |
|-----------|-------------|-----------------|
| Overdue count | "How many overdue projects" | Shows overdue count with breakdown |
| Workload | "What's my workload" | Shows your assigned projects |
| By type | "How many VAT returns are overdue" | Filtered by project type |
| Benched | "How many projects are on the bench" | Shows bench count |

### Known Limitations
- Analytics are aggregate, not individual project details
- For specific project info, use "status of [project]"

---

## Context Awareness

The AI assistant tries to understand context from:
1. **Current page** - If you're on a client page, it knows which client
2. **Conversation history** - Remembers recently mentioned clients/people
3. **Pronouns** - Understands "them", "this client", "that person"

### How to Test
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Page context | Go to client page, say "Email this client" | Should know the client |
| Conversation memory | "Find ABC Ltd", then "Email them" | Should email ABC Ltd |
| Pronoun resolution | "Check Smith VAT", then "Bench it" | Should bench the VAT project |

### Known Limitations
- **BUG:** "This client" not working when on client page (context not passed)
- Page context only works for client/person pages, not project pages

---

## Opening the AI Assistant

1. Click the floating button (magic wand icon) at the bottom right of the screen
2. Or use the keyboard shortcut (if configured)

## Voice Input

- Click the microphone icon to use speech-to-text
- Speak naturally and the assistant will transcribe your request
- Works best in Chrome/Edge browsers

---

## Bug Reports

Please test each feature and report any issues with:
1. What you said
2. What you expected
3. What actually happened
4. Which page you were on when testing
