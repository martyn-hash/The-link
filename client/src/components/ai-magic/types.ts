export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  functionCall?: AIFunctionCall;
  suggestions?: string[];
}

export interface AIFunctionCall {
  name: AIActionType;
  arguments: Record<string, unknown>;
}

export type AIActionType = 
  | 'create_reminder'
  | 'create_task'
  | 'send_email'
  | 'send_sms'
  | 'show_tasks'
  | 'show_reminders'
  | 'show_projects'
  | 'show_tasks_modal'
  | 'get_phone_number'
  | 'navigate_to_client'
  | 'navigate_to_person'
  | 'search_clients'
  | 'ask_clarification'
  | 'request_missing_info'
  | 'get_project_status'
  | 'bench_project'
  | 'unbench_project'
  | 'move_project_stage'
  | 'get_analytics';

// Project match result for AI Magic
export interface ProjectMatch {
  id: string;
  description: string;
  clientName: string;
  projectTypeName: string;
  currentStatus: string;
  assigneeName: string | null;
  dueDate: string | null;
  isBenched: boolean;
  confidence: number;
  matchType: string;
}

// Project details response
export interface ProjectDetails {
  id: string;
  description: string;
  clientId: string;
  clientName: string;
  projectTypeId: string;
  projectTypeName: string;
  currentStatus: string;
  currentAssigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  isBenched: boolean;
  benchReason: string | null;
  preBenchStatus: string | null;
  stages: Array<{ id: string; name: string; order: number }>;
  nextStage: { id: string; name: string; order: number } | null;
  currentStageIndex: number;
}

// Stage reasons response
export interface StageReasonsResponse {
  stageId: string;
  reasons: Array<{ id: string; name: string }>;
  approvalFields: Array<{ id: string; fieldName: string; fieldType: string; isRequired: boolean; options: string[] | null }>;
  requiresNotes: boolean;
}

// Analytics result
export interface AnalyticsResult {
  queryType: string;
  title: string;
  summary: string;
  data: Record<string, unknown>;
  items?: Array<{ label: string; value: number; subtext?: string }>;
}

// Project match response
export interface ProjectMatchResponse {
  matches: ProjectMatch[];
  requiresDisambiguation: boolean;
  bestMatch: ProjectMatch | null;
  confidenceThresholds: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
    MINIMUM: number;
  };
}

export interface AIBackendResponse {
  type: 'function_call' | 'message' | 'clarification' | 'error';
  functionCall?: AIFunctionCall;
  message?: string;
  suggestions?: string[];
}

export interface ConversationContext {
  lastMentionedClient?: { id: string; name: string };
  lastMentionedPerson?: { id: string; name: string };
  lastMentionedUser?: { id: string; name: string };
  lastAction?: AIActionType;
}

export interface FuzzyMatchResult {
  id: string;
  name: string;
  confidence: number;
  matchType?: 'exact' | 'starts_with' | 'abbreviation' | 'contains' | 'fuzzy' | 'word_match';
  email?: string | null;
}

export interface MatchResponse {
  matches: FuzzyMatchResult[];
  requiresDisambiguation: boolean;
  bestMatch: FuzzyMatchResult | null;
  confidenceThresholds: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
    MINIMUM: number;
  };
}

export interface DisambiguationData {
  entityType: 'client' | 'user' | 'person';
  searchTerm: string;
  matches: FuzzyMatchResult[];
  onSelect: (match: FuzzyMatchResult) => void;
  onCancel: () => void;
}

export interface AICommandCategory {
  title: string;
  icon: string;
  commands: AICommandExample[];
}

export interface AICommandExample {
  phrase: string;
  description: string;
}

export const AI_COMMAND_CATEGORIES: AICommandCategory[] = [
  {
    title: 'Create',
    icon: 'plus',
    commands: [
      { phrase: 'Remind me to call John tomorrow at 2pm', description: 'Create a quick reminder' },
      { phrase: 'Create a task for Harry to review the VAT return', description: 'Create a task for a team member' },
      { phrase: 'Send an email to ABC Ltd about their documents', description: 'Compose an email to a client' },
      { phrase: 'Text Sarah at Victoriam about the meeting', description: 'Send an SMS to a contact' },
    ]
  },
  {
    title: 'View',
    icon: 'eye',
    commands: [
      { phrase: 'Show me my tasks', description: 'View your open tasks' },
      { phrase: 'Show me all overdue reminders', description: 'View reminders that are past due' },
      { phrase: 'Show Harry\'s VAT projects', description: 'View projects by type and assignee' },
      { phrase: 'Show me projects due this week', description: 'View upcoming project deadlines' },
    ]
  },
  {
    title: 'Navigate',
    icon: 'compass',
    commands: [
      { phrase: 'Take me to ABC Ltd', description: 'Open a client\'s page' },
      { phrase: 'Go to John Smith\'s profile', description: 'Open a person\'s page' },
      { phrase: 'Find clients matching "Victor"', description: 'Search for clients' },
    ]
  }
];
