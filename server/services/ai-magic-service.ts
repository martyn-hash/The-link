import OpenAI from "openai";
import { storage } from "../storage/index";
import { z } from "zod";

// Lazy initialization of OpenAI client to avoid crashing on import if key is missing
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// Validation schemas for API input
export const conversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string()
});

export const conversationContextSchema = z.object({
  lastMentionedClient: z.object({
    id: z.string(),
    name: z.string()
  }).optional(),
  lastMentionedPerson: z.object({
    id: z.string(),
    name: z.string()
  }).optional(),
  lastMentionedUser: z.object({
    id: z.string(),
    name: z.string()
  }).optional(),
  lastAction: z.string().optional()
}).optional();

// Current page context - what the user is viewing when they make a request
export const currentViewContextSchema = z.object({
  clientId: z.string().optional(),
  clientName: z.string().optional(),
  personId: z.string().optional(),
  personName: z.string().optional(),
  projectId: z.string().optional(),
  projectName: z.string().optional(),
}).optional();

export const chatRequestSchema = z.object({
  message: z.string().min(1, "Message is required"),
  conversationHistory: z.array(conversationMessageSchema).default([]),
  conversationContext: conversationContextSchema.optional(),
  currentViewContext: currentViewContextSchema
});

// Types for AI Magic responses
export interface AIFunctionCall {
  name: string;
  arguments: Record<string, any>;
}

export interface AIMagicResponse {
  type: 'function_call' | 'message' | 'clarification' | 'error';
  functionCall?: AIFunctionCall;
  message?: string;
  suggestions?: string[];
}

// OpenAI function definitions for AI Magic Assistant
const AI_MAGIC_FUNCTIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_reminder",
      description: "Create a quick reminder. Reminders are simple time-based notifications. Can be assigned to the current user or another team member. Do NOT attempt to link reminders to clients or projects.",
      parameters: {
        type: "object",
        properties: {
          title: { 
            type: "string", 
            description: "Brief title of the reminder (e.g., 'Call John', 'Review contract')" 
          },
          details: { 
            type: "string", 
            description: "Additional details or notes for the reminder (optional)" 
          },
          dateTime: { 
            type: "string", 
            description: "ISO 8601 datetime string for when the reminder should trigger. Parse natural language like 'tomorrow at 2pm', 'in 30 minutes', 'next Monday' into proper ISO format using UK timezone (Europe/London)." 
          },
          assigneeName: {
            type: "string",
            description: "Name of the team member to assign this reminder to. Extract the EXACT name mentioned (e.g., 'Bob', 'Sarah Smith'). If the user says 'remind me' or 'myself', leave this empty to assign to current user."
          }
        },
        required: ["title", "dateTime"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a full internal task with assignee, priority, and due date. Tasks are more formal than reminders and can be assigned to other team members.",
      parameters: {
        type: "object",
        properties: {
          title: { 
            type: "string",
            description: "Title of the task" 
          },
          description: { 
            type: "string",
            description: "Detailed description of what needs to be done" 
          },
          assigneeName: { 
            type: "string", 
            description: "Name of the team member to assign this task to. Use 'me' or 'myself' if the user wants to assign to themselves." 
          },
          dueDate: { 
            type: "string", 
            description: "ISO 8601 date string for the due date. Parse natural language into proper format using UK timezone." 
          },
          priority: { 
            type: "string", 
            enum: ["low", "medium", "high"],
            description: "Priority level of the task" 
          },
          taskTypeName: {
            type: "string",
            description: "Type of task. Use context clues to suggest an appropriate type from available options."
          },
          clientName: { 
            type: "string", 
            description: "Name of the client this task relates to (optional)" 
          }
        },
        required: ["title", "dueDate"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_email",
      description: "Compose an email to a client contact. The email will be shown for review before sending.",
      parameters: {
        type: "object",
        properties: {
          recipientName: { 
            type: "string", 
            description: "Name of the person to email" 
          },
          clientName: { 
            type: "string", 
            description: "Name of the client company the recipient belongs to (helps identify the correct person)" 
          },
          subject: { 
            type: "string",
            description: "Email subject line" 
          },
          body: { 
            type: "string",
            description: "Email body content. Use professional, friendly tone." 
          }
        },
        required: ["recipientName"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_sms",
      description: "Compose an SMS text message to a client contact. The message will be shown for review before sending.",
      parameters: {
        type: "object",
        properties: {
          recipientName: { 
            type: "string",
            description: "Name of the person to send SMS to" 
          },
          clientName: { 
            type: "string",
            description: "Name of the client company the recipient belongs to" 
          },
          message: { 
            type: "string",
            description: "SMS message content. Keep it concise (under 160 characters is ideal)." 
          }
        },
        required: ["recipientName", "message"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "navigate_to_client",
      description: "Open a client's detail page directly. Use for commands like 'go to', 'find', 'open', 'show', 'take me to', 'view', or when user references a specific client by name. This should be preferred over search_clients when user wants to view ONE specific client. Examples: 'go to Victoriam', 'find Monkey Access', 'take me to ABC Ltd'.",
      parameters: {
        type: "object",
        properties: {
          clientName: { 
            type: "string", 
            description: "Name or partial name of the client to navigate to" 
          }
        },
        required: ["clientName"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "navigate_to_person",
      description: "Open a person's (contact) detail page.",
      parameters: {
        type: "object",
        properties: {
          personName: { 
            type: "string",
            description: "Name of the person to navigate to" 
          },
          clientName: { 
            type: "string", 
            description: "Name of the client they belong to (helps disambiguate if multiple people have same name)" 
          }
        },
        required: ["personName"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_clients",
      description: "Search for multiple clients or browse clients by criteria. Use ONLY when user explicitly wants to see a LIST of matching clients, wants to browse, or is unsure which client they want. If user mentions a specific client name, use navigate_to_client instead.",
      parameters: {
        type: "object",
        properties: {
          searchTerm: { 
            type: "string",
            description: "Search term to find clients" 
          }
        },
        required: ["searchTerm"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ask_clarification",
      description: "When the user's intent is completely unclear, ask a clarifying question. Use sparingly - prefer making reasonable assumptions when possible.",
      parameters: {
        type: "object",
        properties: {
          question: { 
            type: "string",
            description: "The clarifying question to ask" 
          },
          suggestedCategories: { 
            type: "array", 
            items: { type: "string" },
            description: "Suggested action categories to help the user (e.g., ['Create a reminder', 'Create a task', 'Send a message'])" 
          }
        },
        required: ["question"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "request_missing_info",
      description: "When the intent is clear but essential information is missing, ask for the specific missing information.",
      parameters: {
        type: "object",
        properties: {
          intent: {
            type: "string",
            description: "The understood intent (e.g., 'create_reminder', 'send_email')"
          },
          missingField: { 
            type: "string",
            description: "The name of the missing field" 
          },
          question: { 
            type: "string",
            description: "Natural language question to ask the user" 
          }
        },
        required: ["intent", "missingField", "question"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_project_status",
      description: "Get the current status, stage, and details of ONE specific project for a specific client. Use when user mentions a client name or asks 'status of [client name]', 'what's the status of [company] project', 'check [client] bookkeeping'. This is for individual project lookup, NOT for analytics or counts.",
      parameters: {
        type: "object",
        properties: {
          projectIdentifier: {
            type: "string",
            description: "Identifier for the project - can be client name + project type (e.g., 'Victoriam bookkeeping', 'ABC Ltd VAT', 'Smith payroll'). Include enough context to identify the specific project."
          }
        },
        required: ["projectIdentifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "bench_project",
      description: "Move a project to the bench (temporarily suspend it). Projects can be benched for legacy work, missing data, or other reasons.",
      parameters: {
        type: "object",
        properties: {
          projectIdentifier: {
            type: "string",
            description: "Identifier for the project - client name + project type (e.g., 'Victoriam bookkeeping')"
          },
          benchReason: {
            type: "string",
            enum: ["legacy_work", "missing_data", "other"],
            description: "Reason for benching: 'legacy_work' for historical/legacy work, 'missing_data' for awaiting information, 'other' for any other reason"
          },
          benchReasonOtherText: {
            type: "string",
            description: "Explanation when benchReason is 'other'"
          }
        },
        required: ["projectIdentifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "unbench_project",
      description: "Remove a project from the bench and restore it to its previous stage.",
      parameters: {
        type: "object",
        properties: {
          projectIdentifier: {
            type: "string",
            description: "Identifier for the project to unbench"
          },
          notes: {
            type: "string",
            description: "Optional notes about why the project is being unbenched"
          }
        },
        required: ["projectIdentifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "move_project_stage",
      description: "Move a project to a different stage in its workflow. This will prompt the user to select a change reason and optionally add notes.",
      parameters: {
        type: "object",
        properties: {
          projectIdentifier: {
            type: "string",
            description: "Identifier for the project - client name + project type"
          },
          targetStageName: {
            type: "string",
            description: "Name of the target stage to move to. If not specified or 'next', will move to the next stage in the workflow."
          }
        },
        required: ["projectIdentifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_analytics",
      description: "Get aggregate analytics, counts, and statistics across MULTIPLE projects. Use for questions like 'how many projects are overdue', 'count of VAT returns', 'what's my workload', 'show benched projects count'. NOT for looking up a specific client's project - use get_project_status for that.",
      parameters: {
        type: "object",
        properties: {
          queryType: {
            type: "string",
            enum: ["overdue_count", "workload", "stage_breakdown", "bench_count", "completion_stats", "project_summary"],
            description: "Type of analytics query: 'overdue_count' for overdue projects, 'workload' for user workload stats, 'stage_breakdown' for projects by stage, 'bench_count' for benched projects, 'completion_stats' for completed projects, 'project_summary' for general overview"
          },
          projectTypeName: {
            type: "string",
            description: "Filter by project type (e.g., 'VAT', 'Bookkeeping', 'Payroll')"
          },
          userName: {
            type: "string",
            description: "Filter by user/assignee. Use 'me' for current user."
          },
          clientName: {
            type: "string",
            description: "Filter by client name"
          },
          timeframe: {
            type: "string",
            enum: ["today", "this_week", "this_month", "last_30_days", "all"],
            description: "Time period for the query"
          }
        },
        required: ["queryType"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_phone_number",
      description: "Look up a phone/mobile number for a person (contact). Use for requests like 'find phone number for John', 'what's Jane's mobile', 'do we have a contact number for Bob from ABC Ltd', 'get me martyn's number'.",
      parameters: {
        type: "object",
        properties: {
          personName: {
            type: "string",
            description: "Name of the person to look up the phone number for"
          },
          clientName: {
            type: "string",
            description: "Name of the client/company they belong to (helps disambiguate if multiple people have same name)"
          }
        },
        required: ["personName"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "show_tasks_modal",
      description: "Open an interactive modal showing tasks and reminders. Use for requests like 'show my tasks', 'tasks', 'show reminders', 'my reminders', 'what's on my plate', 'show Sarah's tasks'. The modal has tabs for Internal Tasks and Reminders, and also shows projects where the user is the current assignee.",
      parameters: {
        type: "object",
        properties: {
          userName: {
            type: "string",
            description: "Name of the team member whose tasks to show. Use 'me' for current user's tasks, or a name like 'Sarah' to view their tasks."
          },
          initialTab: {
            type: "string",
            enum: ["tasks", "reminders"],
            description: "Which tab to open initially. Use 'tasks' for task requests, 'reminders' for reminder requests. Defaults to 'tasks'."
          }
        }
      }
    }
  }
];

// Conversation context type for pronoun resolution
interface ConversationContext {
  lastMentionedClient?: { id: string; name: string };
  lastMentionedPerson?: { id: string; name: string };
  lastMentionedUser?: { id: string; name: string };
  lastAction?: string;
}

// Build the system prompt with current context
// Type for current view context
interface CurrentViewContext {
  clientId?: string;
  clientName?: string;
  personId?: string;
  personName?: string;
  projectId?: string;
  projectName?: string;
}

function buildSystemPrompt(
  userName: string, 
  currentDateTime: string, 
  taskTypes?: string[],
  conversationContext?: ConversationContext,
  currentViewContext?: CurrentViewContext
): string {
  const taskTypesContext = taskTypes && taskTypes.length > 0 
    ? `\n\nAvailable task types: ${taskTypes.join(', ')}`
    : '';
  
  // Build current page context section - this takes priority for "this client", "this person" etc.
  let pageContextSection = '';
  if (currentViewContext && (currentViewContext.clientName || currentViewContext.personName || currentViewContext.projectName)) {
    const pageParts: string[] = [];
    if (currentViewContext.clientName) {
      pageParts.push(`- User is viewing client page: "${currentViewContext.clientName}" (ID: ${currentViewContext.clientId})`);
    }
    if (currentViewContext.personName) {
      pageParts.push(`- User is viewing person page: "${currentViewContext.personName}" (ID: ${currentViewContext.personId})`);
    }
    if (currentViewContext.projectName) {
      pageParts.push(`- User is viewing project: "${currentViewContext.projectName}" (ID: ${currentViewContext.projectId})`);
    }
    pageContextSection = `\n\n## Current Page Context (IMPORTANT - use this for "this client", "this person", etc.):
${pageParts.join('\n')}

When user says "this client", "this person", "the current client", "this project", or refers to what they're looking at:
- Use the client/person/project from the Current Page Context above
- This takes precedence over conversation history`;
  }
  
  // Build conversation context section for pronoun resolution
  let contextSection = '';
  if (conversationContext) {
    const contextParts: string[] = [];
    if (conversationContext.lastMentionedClient) {
      contextParts.push(`Last mentioned client: "${conversationContext.lastMentionedClient.name}"`);
    }
    if (conversationContext.lastMentionedPerson) {
      contextParts.push(`Last mentioned person/contact: "${conversationContext.lastMentionedPerson.name}"`);
    }
    if (conversationContext.lastMentionedUser) {
      contextParts.push(`Last mentioned team member: "${conversationContext.lastMentionedUser.name}"`);
    }
    if (conversationContext.lastAction) {
      contextParts.push(`Last action: ${conversationContext.lastAction}`);
    }
    if (contextParts.length > 0) {
      contextSection = `\n\n## Conversation History Context (for pronoun resolution when not on a specific page):
${contextParts.join('\n')}

When user says "them", "they", "him", "her", or refers to someone/something mentioned earlier:
- Use the last mentioned person/client/user from above
- For pronouns referring to a person -> use the last mentioned person
- For pronouns referring to a team member -> use the last mentioned team member`;
    }
  }
    
  return `You are an AI assistant for The Link, a CRM system for accounting and bookkeeping firms. You help users create reminders, tasks, send emails/SMS, and navigate to data.

Current user: ${userName}
Current date/time: ${currentDateTime} (UK timezone - Europe/London)${taskTypesContext}${pageContextSection}${contextSection}

## Your Capabilities:
- Create quick reminders (time-based personal notifications)
- Create internal tasks (assignable work items with priority)
- Compose emails and SMS messages
- Show filtered lists of tasks and reminders
- Navigate to client or person detail pages
- Search for clients

## Guidelines:
1. ALWAYS use UK timezone (Europe/London) for all dates and times
2. When user says "my", "me", or "myself", it refers to the current user: ${userName}
3. Parse natural language dates intelligently:
   - "tomorrow" = next calendar day
   - "next Monday" = the coming Monday
   - "in 2 hours" = current time + 2 hours
   - "this afternoon" = 2pm today
   - "end of day" = 5pm today
4. Be concise and helpful - avoid unnecessary explanations
5. Make reasonable assumptions rather than asking too many questions
6. For ambiguous names, include what you understood so the system can offer matches
7. Default priority is "medium" if not specified
8. Default to the current user as assignee for tasks if not specified
9. Use conversation context to resolve pronouns like "them", "they", "this client"

## Important:
- You cannot directly access or modify the database
- You return structured data that the system will use to show pre-filled forms
- The user will always have a chance to review and confirm before any action is taken

Respond naturally but efficiently. When the user's intent is clear, immediately call the appropriate function.`;
}

// Process a chat message and return AI response
export async function processAIMagicChat(
  message: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  context: {
    currentUserId: string;
    currentUserName: string;
  },
  conversationContext?: ConversationContext,
  currentViewContext?: CurrentViewContext
): Promise<AIMagicResponse> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      type: 'error',
      message: 'AI service is not configured. Please contact your administrator.'
    };
  }

  try {
    // Get current UK time
    const ukDateTime = new Date().toLocaleString('en-GB', {
      timeZone: 'Europe/London',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Fetch task types to provide context to the AI
    let taskTypeNames: string[] = [];
    try {
      const taskTypes = await storage.getAllTaskTypes();
      taskTypeNames = taskTypes.map((t: { name: string }) => t.name);
    } catch (e) {
      console.warn('[AI Magic] Could not fetch task types:', e);
    }

    const systemPrompt = buildSystemPrompt(context.currentUserName, ukDateTime, taskTypeNames, conversationContext, currentViewContext);
    
    if (conversationContext) {
      console.log('[AI Magic] Using conversation context:', conversationContext);
    }
    if (currentViewContext) {
      console.log('[AI Magic] Using current view context:', currentViewContext);
    }

    // Build messages array for OpenAI
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history (last 10 messages for context)
    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    console.log('[AI Magic] Processing message:', message);
    console.log('[AI Magic] Context:', { userId: context.currentUserId, userName: context.currentUserName });

    // Get OpenAI client (lazy-loaded)
    const openai = getOpenAIClient();
    
    // Call OpenAI with function calling
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using gpt-4o-mini for cost efficiency
      messages,
      tools: AI_MAGIC_FUNCTIONS,
      tool_choice: "auto",
      max_tokens: 1024,
    });

    const choice = response.choices[0];
    
    if (!choice) {
      return {
        type: 'error',
        message: 'I had trouble processing that. Please try again.'
      };
    }

    // Check if we got a function call
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      const toolCall = choice.message.tool_calls[0];
      // Type guard for standard tool call
      if (toolCall.type !== 'function') {
        return {
          type: 'error',
          message: 'Unexpected tool call type. Please try again.'
        };
      }
      const functionName = toolCall.function.name;
      let functionArgs: Record<string, any>;
      
      try {
        functionArgs = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error('[AI Magic] Failed to parse function arguments:', e);
        return {
          type: 'error',
          message: 'I had trouble understanding that. Could you rephrase?'
        };
      }

      console.log('[AI Magic] Function call:', functionName, functionArgs);

      // Handle clarification/missing info specially
      if (functionName === 'ask_clarification') {
        return {
          type: 'clarification',
          message: functionArgs.question,
          suggestions: functionArgs.suggestedCategories
        };
      }

      if (functionName === 'request_missing_info') {
        return {
          type: 'clarification',
          message: functionArgs.question,
          suggestions: [functionArgs.intent]
        };
      }

      // Enrich navigation function calls with actual entity IDs
      if (functionName === 'navigate_to_client' && functionArgs.clientName) {
        const matches = await fuzzyMatchClients(functionArgs.clientName, 1);
        if (matches.length > 0 && matches[0].confidence >= 0.4) {
          functionArgs.clientId = matches[0].id;
          functionArgs.clientName = matches[0].name; // Use the actual matched name
          console.log('[AI Magic] Found client:', matches[0].name, 'ID:', matches[0].id, 'confidence:', matches[0].confidence);
        } else {
          console.log('[AI Magic] No client match found for:', functionArgs.clientName);
        }
      }
      
      if (functionName === 'navigate_to_person' && functionArgs.personName) {
        const matches = await fuzzyMatchPeople(functionArgs.personName, undefined, 1);
        if (matches.length > 0 && matches[0].confidence >= 0.4) {
          functionArgs.personId = matches[0].id;
          functionArgs.personName = matches[0].name; // Use the actual matched name
          console.log('[AI Magic] Found person:', matches[0].name, 'ID:', matches[0].id, 'confidence:', matches[0].confidence);
        } else {
          console.log('[AI Magic] No person match found for:', functionArgs.personName);
        }
      }
      
      // Runtime guardrail: Upgrade search_clients to navigate_to_client if high-confidence match
      // This handles cases where the AI interprets "find X" as search instead of navigation
      if (functionName === 'search_clients' && functionArgs.searchTerm) {
        const matches = await fuzzyMatchClients(functionArgs.searchTerm, 2);
        if (matches.length > 0 && matches[0].confidence >= 0.7) {
          // High confidence match - check if second match is much lower (unique match)
          const hasUniqueMatch = matches.length === 1 || 
            (matches.length > 1 && matches[0].confidence - matches[1].confidence >= 0.2);
          
          if (hasUniqueMatch) {
            console.log('[AI Magic] Upgrading search_clients to navigate_to_client:', matches[0].name, 'confidence:', matches[0].confidence);
            // Upgrade to navigation
            return {
              type: 'function_call',
              functionCall: {
                name: 'navigate_to_client',
                arguments: {
                  clientName: matches[0].name,
                  clientId: matches[0].id
                }
              }
            };
          }
        }
      }

      // Return the function call for the frontend to handle
      return {
        type: 'function_call',
        functionCall: {
          name: functionName,
          arguments: functionArgs
        }
      };
    }

    // No function call - return the message as conversational response
    const assistantMessage = choice.message.content || "I'm not sure how to help with that. Try asking me to create a reminder, task, or look up a client.";
    
    return {
      type: 'message',
      message: assistantMessage
    };

  } catch (error: any) {
    console.error('[AI Magic] Error:', error);
    
    // Handle specific OpenAI errors
    if (error.code === 'insufficient_quota') {
      return {
        type: 'error',
        message: 'The AI service is temporarily unavailable. Please try again later.'
      };
    }
    
    if (error.code === 'rate_limit_exceeded') {
      return {
        type: 'error',
        message: 'Too many requests. Please wait a moment and try again.'
      };
    }

    return {
      type: 'error',
      message: 'Something went wrong. Please try again.'
    };
  }
}

// Levenshtein distance algorithm for typo tolerance
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2;
  if (len2 === 0) return len1;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return matrix[len1][len2];
}

// Calculate similarity score (0-1) based on Levenshtein distance
function calculateSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLen);
}

// Check if search term matches as an abbreviation (e.g., "ABC" matches "ABC Limited")
function matchesAbbreviation(searchTerm: string, targetName: string): boolean {
  const searchUpper = searchTerm.toUpperCase();
  const targetWords = targetName.toUpperCase().split(/\s+/);
  
  // Check if it's an exact abbreviation match (first word)
  if (targetWords[0] === searchUpper) {
    return true;
  }
  
  // Check if search term matches initials
  if (searchTerm.length <= 5) {
    const initials = targetWords.map(w => w[0]).join('');
    if (initials.startsWith(searchUpper) || searchUpper === initials) {
      return true;
    }
  }
  
  return false;
}

// Enhanced fuzzy matching result type
export interface FuzzyMatchResult<T = unknown> {
  id: string;
  name: string;
  confidence: number;
  matchType: 'exact' | 'starts_with' | 'abbreviation' | 'contains' | 'fuzzy' | 'word_match';
  data?: T;
}

// Fuzzy match clients by name with enhanced algorithm
export async function fuzzyMatchClients(searchTerm: string, limit: number = 5): Promise<Array<{
  id: string;
  name: string;
  confidence: number;
  matchType?: string;
}>> {
  try {
    const allClients = await storage.getAllClients();
    const searchLower = searchTerm.toLowerCase().trim();
    
    const results: Array<{ id: string; name: string; confidence: number; matchType: string }> = [];
    
    for (const client of allClients) {
      const clientName = (client.name || '').toLowerCase();
      const originalName = client.name || 'Unknown';
      let confidence = 0;
      let matchType = '';
      
      // Exact match
      if (clientName === searchLower) {
        confidence = 1.0;
        matchType = 'exact';
      }
      // Abbreviation match (e.g., "ABC" matches "ABC Limited")
      else if (matchesAbbreviation(searchTerm, originalName)) {
        confidence = 0.95;
        matchType = 'abbreviation';
      }
      // Starts with
      else if (clientName.startsWith(searchLower)) {
        confidence = 0.9;
        matchType = 'starts_with';
      }
      // Contains as a word boundary
      else if (new RegExp(`\\b${searchLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(clientName)) {
        confidence = 0.8;
        matchType = 'word_match';
      }
      // Contains anywhere
      else if (clientName.includes(searchLower)) {
        confidence = 0.7;
        matchType = 'contains';
      }
      // Word match (any word in company name starts with search term)
      else {
        const words = clientName.split(/\s+/);
        for (const word of words) {
          if (word.startsWith(searchLower)) {
            confidence = 0.65;
            matchType = 'word_match';
            break;
          }
        }
      }
      
      // Fuzzy match using Levenshtein distance for typo tolerance
      if (confidence === 0 && searchLower.length >= 3) {
        // Compare with each word and full name
        const similarity = calculateSimilarity(searchLower, clientName);
        const words = clientName.split(/\s+/);
        
        let bestWordSimilarity = 0;
        for (const word of words) {
          if (word.length >= 3) {
            const wordSim = calculateSimilarity(searchLower, word);
            bestWordSimilarity = Math.max(bestWordSimilarity, wordSim);
          }
        }
        
        const bestSimilarity = Math.max(similarity, bestWordSimilarity);
        
        // Only accept fuzzy matches with >70% similarity
        if (bestSimilarity > 0.7) {
          confidence = bestSimilarity * 0.6; // Cap fuzzy matches at 0.6 max
          matchType = 'fuzzy';
        }
      }
      
      if (confidence > 0) {
        results.push({
          id: client.id,
          name: originalName,
          confidence,
          matchType
        });
      }
    }
    
    // Sort by confidence and limit
    return results
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  } catch (error) {
    console.error('[AI Magic] Error matching clients:', error);
    return [];
  }
}

// Fuzzy match users/staff by name with enhanced algorithm
export async function fuzzyMatchUsers(searchTerm: string, limit: number = 5): Promise<Array<{
  id: string;
  name: string;
  email: string;
  confidence: number;
  matchType?: string;
}>> {
  try {
    const allUsers = await storage.getAllUsers();
    const searchLower = searchTerm.toLowerCase().trim();
    
    const results: Array<{ id: string; name: string; email: string; confidence: number; matchType: string }> = [];
    
    for (const user of allUsers) {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
      const firstName = (user.firstName || '').toLowerCase();
      const lastName = (user.lastName || '').toLowerCase();
      
      let confidence = 0;
      let matchType = '';
      
      // Exact full name match
      if (fullName === searchLower) {
        confidence = 1.0;
        matchType = 'exact';
      }
      // First name exact match
      else if (firstName === searchLower) {
        confidence = 0.95;
        matchType = 'exact';
      }
      // Last name exact match
      else if (lastName === searchLower) {
        confidence = 0.9;
        matchType = 'exact';
      }
      // Full name starts with
      else if (fullName.startsWith(searchLower)) {
        confidence = 0.85;
        matchType = 'starts_with';
      }
      // First or last name starts with
      else if (firstName.startsWith(searchLower) || lastName.startsWith(searchLower)) {
        confidence = 0.8;
        matchType = 'starts_with';
      }
      // Contains
      else if (fullName.includes(searchLower)) {
        confidence = 0.6;
        matchType = 'contains';
      }
      
      // Fuzzy match using Levenshtein distance for typo tolerance
      if (confidence === 0 && searchLower.length >= 3) {
        const firstNameSim = firstName.length >= 3 ? calculateSimilarity(searchLower, firstName) : 0;
        const lastNameSim = lastName.length >= 3 ? calculateSimilarity(searchLower, lastName) : 0;
        const fullNameSim = calculateSimilarity(searchLower, fullName);
        
        const bestSimilarity = Math.max(firstNameSim, lastNameSim, fullNameSim);
        
        if (bestSimilarity > 0.7) {
          confidence = bestSimilarity * 0.5; // Cap fuzzy matches at 0.5 max for users
          matchType = 'fuzzy';
        }
      }
      
      if (confidence > 0) {
        const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        results.push({
          id: user.id,
          name: displayName || user.email || 'Unknown',
          email: user.email || '',
          confidence,
          matchType
        });
      }
    }
    
    return results
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  } catch (error) {
    console.error('[AI Magic] Error matching users:', error);
    return [];
  }
}

// Fuzzy match people/contacts by name with enhanced algorithm
export async function fuzzyMatchPeople(
  searchTerm: string, 
  clientId?: string,
  limit: number = 5
): Promise<Array<{
  id: string;
  name: string;
  email: string | null;
  confidence: number;
  matchType?: string;
}>> {
  try {
    // Get all people - we filter by client separately if needed
    const allPeople = await storage.getAllPeople();
    
    const searchLower = searchTerm.toLowerCase().trim();
    
    const results: Array<{
      id: string;
      name: string;
      email: string | null;
      confidence: number;
      matchType: string;
    }> = [];
    
    for (const person of allPeople) {
      const fullName = `${person.firstName || ''} ${person.lastName || ''}`.trim().toLowerCase();
      const firstName = (person.firstName || '').toLowerCase();
      const lastName = (person.lastName || '').toLowerCase();
      
      let confidence = 0;
      let matchType = '';
      
      // Exact full name match
      if (fullName === searchLower) {
        confidence = 1.0;
        matchType = 'exact';
      }
      // First or last name exact match
      else if (firstName === searchLower || lastName === searchLower) {
        confidence = 0.9;
        matchType = 'exact';
      }
      // Full name starts with
      else if (fullName.startsWith(searchLower)) {
        confidence = 0.85;
        matchType = 'starts_with';
      }
      // First or last name starts with
      else if (firstName.startsWith(searchLower) || lastName.startsWith(searchLower)) {
        confidence = 0.75;
        matchType = 'starts_with';
      }
      // Contains
      else if (fullName.includes(searchLower)) {
        confidence = 0.6;
        matchType = 'contains';
      }
      
      // Fuzzy match using Levenshtein distance for typo tolerance
      if (confidence === 0 && searchLower.length >= 3) {
        const firstNameSim = firstName.length >= 3 ? calculateSimilarity(searchLower, firstName) : 0;
        const lastNameSim = lastName.length >= 3 ? calculateSimilarity(searchLower, lastName) : 0;
        const fullNameSim = calculateSimilarity(searchLower, fullName);
        
        const bestSimilarity = Math.max(firstNameSim, lastNameSim, fullNameSim);
        
        if (bestSimilarity > 0.7) {
          confidence = bestSimilarity * 0.5; // Cap fuzzy matches at 0.5 max
          matchType = 'fuzzy';
        }
      }
      
      if (confidence > 0) {
        results.push({
          id: person.id,
          name: `${person.firstName || ''} ${person.lastName || ''}`.trim(),
          email: person.email || null,
          confidence,
          matchType
        });
      }
    }
    
    return results
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  } catch (error) {
    console.error('[AI Magic] Error matching people:', error);
    return [];
  }
}

// Confidence thresholds for disambiguation
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.9,      // High confidence - proceed automatically
  MEDIUM: 0.7,    // Medium confidence - may need confirmation
  LOW: 0.5,       // Low confidence - likely needs disambiguation
  MINIMUM: 0.3    // Minimum to include in results
};

// Check if disambiguation is needed based on matches
export function needsDisambiguation(matches: Array<{ confidence: number }>): boolean {
  if (matches.length === 0) return false;
  if (matches.length === 1 && matches[0].confidence >= CONFIDENCE_THRESHOLDS.HIGH) return false;
  
  // Check if top match is significantly better than second
  if (matches.length >= 2) {
    const topConfidence = matches[0].confidence;
    const secondConfidence = matches[1].confidence;
    
    // If top match is high confidence and significantly better, no disambiguation needed
    if (topConfidence >= CONFIDENCE_THRESHOLDS.HIGH && (topConfidence - secondConfidence) > 0.2) {
      return false;
    }
    
    // If multiple close matches, disambiguation is needed
    if ((topConfidence - secondConfidence) < 0.1) {
      return true;
    }
  }
  
  // If top match is below medium confidence, ask for clarification
  if (matches[0].confidence < CONFIDENCE_THRESHOLDS.MEDIUM) {
    return true;
  }
  
  return false;
}

// Project match result type
export interface ProjectMatch {
  id: string;
  description: string;
  clientName: string;
  projectTypeName: string;
  currentStatus: string;
  assigneeName: string | null;
  dueDate: Date | null;
  isBenched: boolean;
  confidence: number;
  matchType: string;
}

// Fuzzy match projects by identifier (client name + project type)
export async function fuzzyMatchProjects(
  searchTerm: string,
  limit: number = 5
): Promise<ProjectMatch[]> {
  try {
    // Get all active projects with their related data
    const allProjects = await storage.getAllProjects({});
    const clients = await storage.getAllClients();
    const projectTypes = await storage.getAllProjectTypes();
    const users = await storage.getAllUsers();
    
    // Create lookup maps
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    const projectTypeMap = new Map(projectTypes.map(pt => [pt.id, pt.name]));
    const userMap = new Map(users.map(u => [u.id, `${u.firstName || ''} ${u.lastName || ''}`.trim()]));
    
    const searchLower = searchTerm.toLowerCase().trim();
    const searchWords = searchLower.split(/\s+/).filter(w => w.length >= 2);
    
    const results: ProjectMatch[] = [];
    
    for (const project of allProjects) {
      // Skip completed or inactive projects unless explicitly searching
      if (project.completionStatus && !searchLower.includes('completed')) continue;
      if (project.inactive && !searchLower.includes('inactive')) continue;
      
      const clientName = clientMap.get(project.clientId) || '';
      const projectTypeName = projectTypeMap.get(project.projectTypeId || '') || '';
      const assigneeName = project.currentAssigneeId ? userMap.get(project.currentAssigneeId) || null : null;
      
      const clientLower = clientName.toLowerCase();
      const typeLower = projectTypeName.toLowerCase();
      const descLower = (project.description || '').toLowerCase();
      
      // Create combined search text
      const combinedText = `${clientLower} ${typeLower} ${descLower}`;
      
      let confidence = 0;
      let matchType = '';
      
      // Check for exact phrase match
      if (combinedText.includes(searchLower)) {
        confidence = 0.95;
        matchType = 'exact_phrase';
      }
      // Check if all search words are present
      else if (searchWords.length > 0 && searchWords.every(word => combinedText.includes(word))) {
        confidence = 0.85;
        matchType = 'all_words';
      }
      // Check for partial matches
      else {
        let wordMatches = 0;
        for (const word of searchWords) {
          if (combinedText.includes(word)) {
            wordMatches++;
          } else {
            // Try fuzzy matching for each word
            const clientSim = calculateSimilarity(word, clientLower);
            const typeSim = calculateSimilarity(word, typeLower);
            if (clientSim > 0.7 || typeSim > 0.7) {
              wordMatches += 0.5;
            }
          }
        }
        
        if (wordMatches > 0 && searchWords.length > 0) {
          confidence = (wordMatches / searchWords.length) * 0.7;
          matchType = 'partial';
        }
      }
      
      // Boost confidence for client name matches
      if (clientLower.includes(searchLower) || searchLower.includes(clientLower)) {
        confidence = Math.min(1, confidence + 0.15);
      }
      
      // Boost for project type matches
      const commonTypes = ['vat', 'bookkeeping', 'payroll', 'accounts', 'tax', 'annual'];
      for (const type of commonTypes) {
        if (searchLower.includes(type) && typeLower.includes(type)) {
          confidence = Math.min(1, confidence + 0.1);
          break;
        }
      }
      
      if (confidence > 0.3) {
        results.push({
          id: project.id,
          description: project.description || projectTypeName,
          clientName,
          projectTypeName,
          currentStatus: project.currentStatus || 'Unknown',
          assigneeName,
          dueDate: project.dueDate,
          isBenched: project.isBenched || false,
          confidence,
          matchType
        });
      }
    }
    
    return results
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  } catch (error) {
    console.error('[AI Magic] Error matching projects:', error);
    return [];
  }
}

// Analytics query types
export type AnalyticsQueryType = 
  | 'overdue_count' 
  | 'workload' 
  | 'stage_breakdown' 
  | 'bench_count' 
  | 'completion_stats' 
  | 'project_summary';

// Analytics result interface
export interface AnalyticsResult {
  queryType: AnalyticsQueryType;
  title: string;
  summary: string;
  data: Record<string, any>;
  items?: Array<{ label: string; value: number; subtext?: string }>;
}

// Get project analytics
export async function getProjectAnalytics(
  queryType: AnalyticsQueryType,
  filters?: {
    projectTypeName?: string;
    userName?: string;
    clientName?: string;
    timeframe?: string;
    userId?: string; // Current user ID for "me" queries
  }
): Promise<AnalyticsResult> {
  try {
    const allProjects = await storage.getAllProjects({});
    const projectTypes = await storage.getAllProjectTypes();
    const users = await storage.getAllUsers();
    const clients = await storage.getAllClients();
    
    // Create lookup maps
    const projectTypeMap = new Map(projectTypes.map(pt => [pt.id, pt.name]));
    const projectTypeIdMap = new Map(projectTypes.map(pt => [pt.name.toLowerCase(), pt.id]));
    const userMap = new Map(users.map(u => [u.id, `${u.firstName || ''} ${u.lastName || ''}`.trim()]));
    const userIdMap = new Map(users.map(u => [`${u.firstName || ''} ${u.lastName || ''}`.trim().toLowerCase(), u.id]));
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    
    // Apply filters
    let filteredProjects = allProjects.filter(p => !p.inactive && !p.completionStatus);
    
    if (filters?.projectTypeName) {
      const typeIdFilter = projectTypeIdMap.get(filters.projectTypeName.toLowerCase());
      if (typeIdFilter) {
        filteredProjects = filteredProjects.filter(p => p.projectTypeId === typeIdFilter);
      }
    }
    
    if (filters?.userName) {
      let targetUserId = filters.userId;
      if (filters.userName.toLowerCase() !== 'me') {
        targetUserId = userIdMap.get(filters.userName.toLowerCase());
      }
      if (targetUserId) {
        filteredProjects = filteredProjects.filter(p => p.currentAssigneeId === targetUserId);
      }
    }
    
    if (filters?.clientName) {
      const clientIds = Array.from(clientMap.entries())
        .filter(([_, name]) => name.toLowerCase().includes(filters.clientName!.toLowerCase()))
        .map(([id]) => id);
      filteredProjects = filteredProjects.filter(p => clientIds.includes(p.clientId));
    }
    
    // Apply timeframe filter
    const now = new Date();
    if (filters?.timeframe) {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfDay);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      switch (filters.timeframe) {
        case 'today':
          filteredProjects = filteredProjects.filter(p => 
            p.dueDate && new Date(p.dueDate) >= startOfDay && new Date(p.dueDate) < new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
          );
          break;
        case 'this_week':
          filteredProjects = filteredProjects.filter(p => 
            p.dueDate && new Date(p.dueDate) >= startOfWeek
          );
          break;
        case 'this_month':
          filteredProjects = filteredProjects.filter(p => 
            p.dueDate && new Date(p.dueDate) >= startOfMonth
          );
          break;
        case 'last_30_days':
          filteredProjects = filteredProjects.filter(p => 
            p.dueDate && new Date(p.dueDate) >= thirtyDaysAgo
          );
          break;
      }
    }
    
    // Execute query based on type
    switch (queryType) {
      case 'overdue_count': {
        const overdueProjects = filteredProjects.filter(p => 
          p.dueDate && new Date(p.dueDate) < now && !p.isBenched
        );
        
        // Group by project type
        const byType: Record<string, number> = {};
        for (const p of overdueProjects) {
          const typeName = projectTypeMap.get(p.projectTypeId || '') || 'Other';
          byType[typeName] = (byType[typeName] || 0) + 1;
        }
        
        const items = Object.entries(byType)
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value);
        
        return {
          queryType,
          title: 'Overdue Projects',
          summary: `${overdueProjects.length} project${overdueProjects.length !== 1 ? 's' : ''} overdue`,
          data: { total: overdueProjects.length, byType },
          items
        };
      }
      
      case 'workload': {
        // Group by assignee
        const byAssignee: Record<string, { total: number; overdue: number }> = {};
        
        for (const p of filteredProjects) {
          if (!p.isBenched) {
            const assigneeName = p.currentAssigneeId ? (userMap.get(p.currentAssigneeId) || 'Unassigned') : 'Unassigned';
            if (!byAssignee[assigneeName]) {
              byAssignee[assigneeName] = { total: 0, overdue: 0 };
            }
            byAssignee[assigneeName].total++;
            if (p.dueDate && new Date(p.dueDate) < now) {
              byAssignee[assigneeName].overdue++;
            }
          }
        }
        
        const items = Object.entries(byAssignee)
          .map(([label, data]) => ({ 
            label, 
            value: data.total,
            subtext: data.overdue > 0 ? `${data.overdue} overdue` : undefined
          }))
          .sort((a, b) => b.value - a.value);
        
        const totalProjects = filteredProjects.filter(p => !p.isBenched).length;
        
        return {
          queryType,
          title: 'Team Workload',
          summary: `${totalProjects} active project${totalProjects !== 1 ? 's' : ''} across ${items.length} team member${items.length !== 1 ? 's' : ''}`,
          data: { totalProjects, byAssignee },
          items
        };
      }
      
      case 'stage_breakdown': {
        const byStage: Record<string, number> = {};
        
        for (const p of filteredProjects) {
          if (!p.isBenched) {
            const stage = p.currentStatus || 'Unknown';
            byStage[stage] = (byStage[stage] || 0) + 1;
          }
        }
        
        const items = Object.entries(byStage)
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value);
        
        return {
          queryType,
          title: 'Projects by Stage',
          summary: `${filteredProjects.filter(p => !p.isBenched).length} projects across ${items.length} stages`,
          data: { byStage },
          items
        };
      }
      
      case 'bench_count': {
        const benchedProjects = allProjects.filter(p => p.isBenched && !p.inactive && !p.completionStatus);
        
        // Group by bench reason
        const byReason: Record<string, number> = {};
        for (const p of benchedProjects) {
          const reason = p.benchReason || 'unknown';
          const reasonLabel = reason === 'legacy_work' ? 'Legacy Work' 
            : reason === 'missing_data' ? 'Missing Data' 
            : reason === 'other' ? 'Other' : 'Unknown';
          byReason[reasonLabel] = (byReason[reasonLabel] || 0) + 1;
        }
        
        const items = Object.entries(byReason)
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value);
        
        return {
          queryType,
          title: 'Benched Projects',
          summary: `${benchedProjects.length} project${benchedProjects.length !== 1 ? 's' : ''} on the bench`,
          data: { total: benchedProjects.length, byReason },
          items
        };
      }
      
      case 'completion_stats': {
        const completedProjects = allProjects.filter(p => p.completionStatus && !p.inactive);
        
        // Group by completion month - use updatedAt as proxy for completion date
        const byMonth: Record<string, number> = {};
        for (const p of completedProjects) {
          const completionDate = (p as any).completedAt || p.updatedAt;
          if (completionDate) {
            const date = new Date(completionDate);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;
          }
        }
        
        const items = Object.entries(byMonth)
          .sort((a, b) => b[0].localeCompare(a[0]))
          .slice(0, 6)
          .map(([label, value]) => ({ label, value }));
        
        return {
          queryType,
          title: 'Completion Statistics',
          summary: `${completedProjects.length} projects completed`,
          data: { total: completedProjects.length, byMonth },
          items
        };
      }
      
      case 'project_summary':
      default: {
        const activeCount = filteredProjects.filter(p => !p.isBenched).length;
        const benchedCount = filteredProjects.filter(p => p.isBenched).length;
        const overdueCount = filteredProjects.filter(p => 
          p.dueDate && new Date(p.dueDate) < now && !p.isBenched
        ).length;
        
        const items = [
          { label: 'Active Projects', value: activeCount },
          { label: 'Overdue', value: overdueCount },
          { label: 'On Bench', value: benchedCount }
        ];
        
        return {
          queryType,
          title: 'Project Summary',
          summary: `${activeCount} active, ${overdueCount} overdue, ${benchedCount} benched`,
          data: { activeCount, benchedCount, overdueCount },
          items
        };
      }
    }
  } catch (error) {
    console.error('[AI Magic] Error getting analytics:', error);
    return {
      queryType,
      title: 'Error',
      summary: 'Failed to fetch analytics',
      data: { error: String(error) },
      items: []
    };
  }
}
