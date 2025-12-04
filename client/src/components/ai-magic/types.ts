export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  action?: AIAction;
}

export interface AIAction {
  type: AIActionType;
  data: Record<string, unknown>;
  status: 'pending' | 'ready' | 'completed' | 'cancelled';
}

export type AIActionType = 
  | 'create_reminder'
  | 'create_task'
  | 'send_email'
  | 'send_sms'
  | 'show_tasks'
  | 'show_reminders'
  | 'show_projects'
  | 'navigate_to_client'
  | 'navigate_to_person'
  | 'search_clients'
  | 'ask_clarification'
  | 'request_missing_info';

export interface ConversationContext {
  lastMentionedClient?: { id: string; name: string };
  lastMentionedPerson?: { id: string; name: string };
  lastMentionedUser?: { id: string; name: string };
  lastAction?: AIActionType;
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
