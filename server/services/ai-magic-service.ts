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

export const chatRequestSchema = z.object({
  message: z.string().min(1, "Message is required"),
  conversationHistory: z.array(conversationMessageSchema).default([])
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
      description: "Create a quick reminder. Reminders are simple time-based notifications. Can be assigned to the current user or another team member.",
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
            description: "Name of the team member to assign this reminder to. If not specified or 'me'/'myself', assigns to current user. Look for phrases like 'remind Bob', 'for Sarah', 'assign to John'."
          },
          clientName: { 
            type: "string", 
            description: "Name of the client to link to this reminder (optional). Use for context like 'remind me to call Smith & Co'" 
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
      name: "show_tasks",
      description: "Display a list of internal tasks, optionally filtered by various criteria.",
      parameters: {
        type: "object",
        properties: {
          assigneeName: { 
            type: "string", 
            description: "Filter by assignee name. Use 'me' for current user's tasks." 
          },
          status: { 
            type: "string", 
            enum: ["open", "in_progress", "closed", "all"],
            description: "Filter by task status" 
          },
          clientName: { 
            type: "string",
            description: "Filter by tasks linked to a specific client" 
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "show_reminders",
      description: "Display a list of quick reminders for the current user or a specified team member.",
      parameters: {
        type: "object",
        properties: {
          assigneeName: { 
            type: "string", 
            description: "Whose reminders to show. Use 'me' for current user's reminders." 
          },
          timeframe: { 
            type: "string", 
            enum: ["today", "this_week", "overdue", "upcoming", "all"],
            description: "Filter by timeframe" 
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "navigate_to_client",
      description: "Open a client's detail page. Use when user wants to view a specific client's information.",
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
      description: "Search for clients by name or other criteria. Returns a list of matching clients.",
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
  }
];

// Build the system prompt with current context
function buildSystemPrompt(userName: string, currentDateTime: string, taskTypes?: string[]): string {
  const taskTypesContext = taskTypes && taskTypes.length > 0 
    ? `\n\nAvailable task types: ${taskTypes.join(', ')}`
    : '';
    
  return `You are an AI assistant for The Link, a CRM system for accounting and bookkeeping firms. You help users create reminders, tasks, send emails/SMS, and navigate to data.

Current user: ${userName}
Current date/time: ${currentDateTime} (UK timezone - Europe/London)${taskTypesContext}

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
  }
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

    const systemPrompt = buildSystemPrompt(context.currentUserName, ukDateTime, taskTypeNames);

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

// Fuzzy match clients by name
export async function fuzzyMatchClients(searchTerm: string, limit: number = 5): Promise<Array<{
  id: string;
  name: string;
  confidence: number;
}>> {
  try {
    const allClients = await storage.getAllClients();
    const searchLower = searchTerm.toLowerCase().trim();
    
    const results: Array<{ id: string; name: string; confidence: number }> = [];
    
    for (const client of allClients) {
      const clientName = (client.name || '').toLowerCase();
      let confidence = 0;
      
      // Exact match
      if (clientName === searchLower) {
        confidence = 1.0;
      }
      // Starts with
      else if (clientName.startsWith(searchLower)) {
        confidence = 0.9;
      }
      // Contains
      else if (clientName.includes(searchLower)) {
        confidence = 0.7;
      }
      // Word match (any word in company name matches)
      else {
        const words = clientName.split(/\s+/);
        for (const word of words) {
          if (word.startsWith(searchLower)) {
            confidence = 0.6;
            break;
          }
        }
      }
      
      if (confidence > 0) {
        results.push({
          id: client.id,
          name: client.name || 'Unknown',
          confidence
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

// Fuzzy match users/staff by name
export async function fuzzyMatchUsers(searchTerm: string, limit: number = 5): Promise<Array<{
  id: string;
  name: string;
  email: string;
  confidence: number;
}>> {
  try {
    const allUsers = await storage.getAllUsers();
    const searchLower = searchTerm.toLowerCase().trim();
    
    const results: Array<{ id: string; name: string; email: string; confidence: number }> = [];
    
    for (const user of allUsers) {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
      const firstName = (user.firstName || '').toLowerCase();
      const lastName = (user.lastName || '').toLowerCase();
      
      let confidence = 0;
      
      // Exact full name match
      if (fullName === searchLower) {
        confidence = 1.0;
      }
      // First name exact match
      else if (firstName === searchLower) {
        confidence = 0.95;
      }
      // Last name exact match
      else if (lastName === searchLower) {
        confidence = 0.9;
      }
      // Full name starts with
      else if (fullName.startsWith(searchLower)) {
        confidence = 0.85;
      }
      // First or last name starts with
      else if (firstName.startsWith(searchLower) || lastName.startsWith(searchLower)) {
        confidence = 0.8;
      }
      // Contains
      else if (fullName.includes(searchLower)) {
        confidence = 0.6;
      }
      
      if (confidence > 0) {
        const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        results.push({
          id: user.id,
          name: displayName || user.email || 'Unknown',
          email: user.email || '',
          confidence
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

// Fuzzy match people/contacts by name
export async function fuzzyMatchPeople(
  searchTerm: string, 
  clientId?: string,
  limit: number = 5
): Promise<Array<{
  id: string;
  name: string;
  email: string | null;
  confidence: number;
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
    }> = [];
    
    for (const person of allPeople) {
      const fullName = `${person.firstName || ''} ${person.lastName || ''}`.trim().toLowerCase();
      const firstName = (person.firstName || '').toLowerCase();
      const lastName = (person.lastName || '').toLowerCase();
      
      let confidence = 0;
      
      if (fullName === searchLower) {
        confidence = 1.0;
      } else if (firstName === searchLower || lastName === searchLower) {
        confidence = 0.9;
      } else if (fullName.startsWith(searchLower)) {
        confidence = 0.85;
      } else if (firstName.startsWith(searchLower) || lastName.startsWith(searchLower)) {
        confidence = 0.75;
      } else if (fullName.includes(searchLower)) {
        confidence = 0.6;
      }
      
      if (confidence > 0) {
        results.push({
          id: person.id,
          name: `${person.firstName || ''} ${person.lastName || ''}`.trim(),
          email: person.email || null,
          confidence
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
