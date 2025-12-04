import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Mic, 
  MicOff, 
  Info, 
  Loader2,
  Sparkles,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { AIMessage, AIBackendResponse, AIFunctionCall, ConversationContext } from './types';
import { ActionCard } from './AIMagicActionCards';
import { AIMagicHelpModal } from './AIMagicHelpModal';
import { nanoid } from 'nanoid';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => ISpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface AIMagicChatPanelProps {
  onClose: () => void;
}

type ActionStatus = 'pending' | 'completed' | 'dismissed';

// Smart suggestion type
interface SmartSuggestion {
  label: string;
  command: string;
}

export function AIMagicChatPanel({ onClose }: AIMagicChatPanelProps) {
  const { toast } = useToast();
  const [location] = useLocation();
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm your AI assistant. I can help you create reminders, tasks, send emails, or find information. Try saying something like \"Remind me to call John tomorrow\" or \"Show me my tasks\".",
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [actionStatuses, setActionStatuses] = useState<Record<string, ActionStatus>>({});
  const [conversationContext, setConversationContext] = useState<ConversationContext>({});
  
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  // Parse current location for context
  const clientIdMatch = location.match(/\/clients\/([^/]+)/);
  const personIdMatch = location.match(/\/people\/([^/]+)/);
  const currentClientId = clientIdMatch?.[1];
  const currentPersonId = personIdMatch?.[1];

  // Fetch current client data if on a client page
  const { data: currentClient } = useQuery<{ id: string; name: string }>({
    queryKey: ['/api/clients', currentClientId],
    enabled: !!currentClientId,
  });

  // Fetch current person data if on a person page
  const { data: currentPerson } = useQuery<{ id: string; firstName: string | null; lastName: string | null; clientId: string }>({
    queryKey: ['/api/people', currentPersonId],
    enabled: !!currentPersonId,
  });

  // Generate smart suggestions based on current context
  const getSmartSuggestions = (): SmartSuggestion[] => {
    const suggestions: SmartSuggestion[] = [];

    // Client-specific suggestions
    if (currentClient) {
      suggestions.push(
        { label: `Remind about ${currentClient.name}`, command: `Remind me to follow up with ${currentClient.name} tomorrow` },
        { label: `Email ${currentClient.name}`, command: `Send an email to ${currentClient.name}` }
      );
    }

    // Person-specific suggestions
    if (currentPerson) {
      const personName = `${currentPerson.firstName || ''} ${currentPerson.lastName || ''}`.trim();
      if (personName) {
        suggestions.push(
          { label: `Email ${personName}`, command: `Send an email to ${personName}` },
          { label: `SMS ${personName}`, command: `Send a text to ${personName}` }
        );
      }
    }

    // Page-specific suggestions
    if (location.includes('/internal-tasks')) {
      suggestions.push(
        { label: 'My tasks', command: 'Show me my tasks' },
        { label: 'Overdue tasks', command: 'Show me overdue tasks' }
      );
    } else if (location.includes('/clients')) {
      suggestions.push(
        { label: 'Search clients', command: 'Find client ' }
      );
    }

    // Context-based suggestions (from conversation memory)
    if (conversationContext.lastMentionedClient?.name && !currentClient) {
      suggestions.push(
        { label: `More about ${conversationContext.lastMentionedClient.name}`, command: `Take me to ${conversationContext.lastMentionedClient.name}` }
      );
    }
    if (conversationContext.lastMentionedPerson?.name && !currentPerson) {
      suggestions.push(
        { label: `Email ${conversationContext.lastMentionedPerson.name}`, command: `Send an email to ${conversationContext.lastMentionedPerson.name}` }
      );
    }

    // Default suggestions if nothing context-specific
    if (suggestions.length === 0) {
      suggestions.push(
        { label: 'New reminder', command: 'Remind me to ' },
        { label: 'My tasks', command: 'Show me my tasks' },
        { label: 'Find client', command: 'Find client ' }
      );
    }

    // Limit to 3 suggestions
    return suggestions.slice(0, 3);
  };

  const smartSuggestions = getSmartSuggestions();

  const handleSuggestionClick = (command: string) => {
    setInputValue(command);
    inputRef.current?.focus();
    // If the command doesn't end with a space (meaning it's complete), send it
    if (!command.endsWith(' ')) {
      setTimeout(() => {
        // Simulate sending after a brief delay to let state update
        const input = inputRef.current;
        if (input) {
          const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
          input.dispatchEvent(event);
        }
      }, 50);
    }
  };
  
  // Helper to update context based on function call - uses functional update to avoid stale closure
  const updateContextFromFunctionCall = (functionCall: AIFunctionCall) => {
    const args = functionCall.arguments as Record<string, unknown>;
    
    setConversationContext(prev => {
      const newContext: ConversationContext = { ...prev };
      
      // Extract client context
      if (args.clientName && typeof args.clientName === 'string') {
        newContext.lastMentionedClient = { id: '', name: args.clientName };
      }
      
      // For navigation to client, extract the client name
      if (functionCall.name === 'navigate_to_client' && args.clientName && typeof args.clientName === 'string') {
        newContext.lastMentionedClient = { id: '', name: args.clientName };
      }
      
      // For search clients, extract the search term as potential client
      if (functionCall.name === 'search_clients' && args.searchTerm && typeof args.searchTerm === 'string') {
        newContext.lastMentionedClient = { id: '', name: args.searchTerm };
      }
      
      // Extract person context (for emails/SMS)
      if (args.recipientName && typeof args.recipientName === 'string') {
        newContext.lastMentionedPerson = { id: '', name: args.recipientName };
      }
      if (args.personName && typeof args.personName === 'string') {
        newContext.lastMentionedPerson = { id: '', name: args.personName };
      }
      
      // Extract assignee context (for tasks/reminders)
      if (args.assigneeName && typeof args.assigneeName === 'string' && 
          args.assigneeName !== 'me' && args.assigneeName !== 'myself') {
        newContext.lastMentionedUser = { id: '', name: args.assigneeName };
      }
      
      // Track last action
      newContext.lastAction = functionCall.name;
      
      console.log('[AI Magic] Updated conversation context:', newContext);
      return newContext;
    });
  };

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: AIMessage = {
      id: nanoid(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    const loadingMessage: AIMessage = {
      id: 'loading',
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };
    setMessages(prev => [...prev, loadingMessage]);

    try {
      // Build context to send - only include non-empty values
      const contextToSend: ConversationContext = {};
      if (conversationContext.lastMentionedClient?.name) {
        contextToSend.lastMentionedClient = conversationContext.lastMentionedClient;
      }
      if (conversationContext.lastMentionedPerson?.name) {
        contextToSend.lastMentionedPerson = conversationContext.lastMentionedPerson;
      }
      if (conversationContext.lastMentionedUser?.name) {
        contextToSend.lastMentionedUser = conversationContext.lastMentionedUser;
      }
      if (conversationContext.lastAction) {
        contextToSend.lastAction = conversationContext.lastAction;
      }
      
      // Build current view context - what page the user is currently viewing
      const currentViewContext: {
        clientId?: string;
        clientName?: string;
        personId?: string;
        personName?: string;
      } = {};
      if (currentClient) {
        currentViewContext.clientId = currentClient.id;
        currentViewContext.clientName = currentClient.name;
      }
      if (currentPerson) {
        currentViewContext.personId = currentPerson.id;
        currentViewContext.personName = `${currentPerson.firstName || ''} ${currentPerson.lastName || ''}`.trim();
      }
      
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: messages
            .filter(m => m.id !== 'welcome' && !m.isLoading)
            .map(m => ({ role: m.role, content: m.content })),
          conversationContext: Object.keys(contextToSend).length > 0 ? contextToSend : undefined,
          currentViewContext: Object.keys(currentViewContext).length > 0 ? currentViewContext : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data: AIBackendResponse = await response.json();
      
      // Handle different response types
      let responseMessage: AIMessage;
      const messageId = nanoid();
      
      if (data.type === 'function_call' && data.functionCall) {
        // AI detected an action - show action card for confirmation
        const actionName = data.functionCall.name.replace(/_/g, ' ');
        const args = data.functionCall.arguments;
        let description = `I understood: ${actionName}`;
        
        // Build a friendly description based on the function
        if (data.functionCall.name === 'create_reminder') {
          description = `Got it! I'll help you create a reminder.`;
        } else if (data.functionCall.name === 'create_task') {
          description = `Got it! I'll help you create a task.`;
        } else if (data.functionCall.name === 'send_email') {
          description = `Got it! I'll help you compose an email.`;
        } else if (data.functionCall.name === 'send_sms') {
          description = `Got it! I'll help you send an SMS.`;
        } else if (data.functionCall.name === 'navigate_to_client' || data.functionCall.name === 'navigate_to_person') {
          description = `Found it! Let me take you there.`;
        } else if (data.functionCall.name === 'search_clients') {
          description = `I'll search for that.`;
        } else if (data.functionCall.name === 'show_tasks') {
          description = `Here are your tasks.`;
        } else if (data.functionCall.name === 'show_reminders') {
          description = `Here are your reminders.`;
        } else if (data.functionCall.name === 'get_project_status') {
          description = `Looking up that project for you.`;
        } else if (data.functionCall.name === 'bench_project') {
          description = `I'll help you bench that project.`;
        } else if (data.functionCall.name === 'unbench_project') {
          description = `I'll help you unbench that project.`;
        } else if (data.functionCall.name === 'move_project_stage') {
          description = `I'll help you move that project to a new stage.`;
        } else if (data.functionCall.name === 'get_analytics') {
          description = `Let me get that data for you.`;
        }
        
        responseMessage = {
          id: messageId,
          role: 'assistant',
          content: description,
          timestamp: new Date(),
          functionCall: data.functionCall,
        };
        
        // Set action status to pending so the card shows
        setActionStatuses(prev => ({ ...prev, [messageId]: 'pending' }));
        
        // Update conversation context from function call for pronoun resolution
        updateContextFromFunctionCall(data.functionCall);
      } else if (data.type === 'clarification') {
        responseMessage = {
          id: nanoid(),
          role: 'assistant',
          content: data.message || "Could you tell me more about what you'd like to do?",
          timestamp: new Date(),
          suggestions: data.suggestions,
        };
      } else if (data.type === 'error') {
        responseMessage = {
          id: nanoid(),
          role: 'assistant',
          content: data.message || "Something went wrong. Please try again.",
          timestamp: new Date(),
        };
      } else {
        // Regular message response
        responseMessage = {
          id: nanoid(),
          role: 'assistant',
          content: data.message || "I'm not sure how to help with that. Try asking me to create a reminder or task.",
          timestamp: new Date(),
        };
      }
      
      setMessages(prev => [
        ...prev.filter(m => m.id !== 'loading'),
        responseMessage
      ]);
    } catch (error) {
      setMessages(prev => [
        ...prev.filter(m => m.id !== 'loading'),
        {
          id: nanoid(),
          role: 'assistant',
          content: "I'm having trouble connecting right now. Please try again in a moment.",
          timestamp: new Date(),
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-GB';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      setInputValue(transcript);
      
      // Auto-stop after getting a final result to allow user to send
      const lastResult = event.results[event.results.length - 1];
      if (lastResult.isFinal) {
        // Give a brief moment for the user to see the result, then stop
        setTimeout(() => {
          if (recognitionRef.current) {
            recognitionRef.current.stop();
          }
        }, 500);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      
      // Show user-friendly error for common issues
      if (event.error === 'not-allowed') {
        toast({
          title: 'Microphone access denied',
          description: 'Please allow microphone access in your browser settings.',
          variant: 'destructive'
        });
      } else if (event.error === 'no-speech') {
        // No speech detected - this is normal, just stop quietly
      } else if (event.error === 'network') {
        toast({
          title: 'Voice recognition unavailable',
          description: 'Please check your internet connection.',
          variant: 'destructive'
        });
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    
    try {
      recognition.start();
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Find the active action card (first pending action)
  const activeActionMessage = messages.find(
    m => m.functionCall && actionStatuses[m.id] === 'pending'
  );
  const hasActiveAction = !!activeActionMessage;
  
  // Use inline cards on mobile, side panel on desktop
  const isMobile = useIsMobile();
  const showSidePanel = !isMobile && hasActiveAction;
  const showInlineCards = isMobile;

  return (
    <>
      <div className={cn(
        "fixed bottom-24 z-50 flex items-end gap-3",
        isMobile ? "left-4 right-4" : "left-6"
      )}>
        {/* Main Chat Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={cn(
            "bg-card border border-border rounded-2xl shadow-2xl",
            "flex flex-col overflow-hidden",
            isMobile ? "w-full" : "w-[340px] max-w-[calc(100vw-3rem)]"
          )}
          style={{ height: isMobile ? 'min(450px, calc(100vh - 10rem))' : 'min(500px, calc(100vh - 10rem))' }}
          data-testid="panel-ai-chat"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">AI Assistant</h3>
                <p className="text-xs text-muted-foreground">Ask me anything</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowHelp(true)}
              data-testid="button-ai-help"
            >
              <Info className="w-4 h-4" />
            </Button>
          </div>

          <ScrollArea 
            className="flex-1 p-4 overflow-y-auto" 
            style={{ minHeight: '150px' }}
          >
            <div className="space-y-4">
              {messages.map((message) => (
                <MessageBubble 
                  key={message.id} 
                  message={message}
                  actionStatus={actionStatuses[message.id]}
                  showActionInline={showInlineCards}
                  onActionComplete={(success, resultMessage) => {
                    setActionStatuses(prev => ({ ...prev, [message.id]: 'completed' }));
                    if (success) {
                      setMessages(prev => [...prev, {
                        id: nanoid(),
                        role: 'assistant',
                        content: resultMessage,
                        timestamp: new Date(),
                      }]);
                      // Close AI panel after successful action
                      setTimeout(() => onClose(), 500);
                    }
                  }}
                  onActionDismiss={() => {
                    setActionStatuses(prev => ({ ...prev, [message.id]: 'dismissed' }));
                  }}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="p-3 border-t border-border bg-muted/20 space-y-2">
            {/* Smart Suggestions */}
            {smartSuggestions.length > 0 && !isLoading && !inputValue && (
              <div className="flex flex-wrap gap-1.5">
                {smartSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion.command)}
                    className="px-2.5 py-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors border border-primary/20"
                    data-testid={`suggestion-chip-${index}`}
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isRecording ? "Listening..." : "Type or speak your request..."}
                  className={cn(
                    "pr-10 bg-background",
                    isRecording && "border-red-500 animate-pulse"
                  )}
                  disabled={isLoading}
                  data-testid="input-ai-message"
                />
                {voiceSupported && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7",
                      isRecording && "text-red-500"
                    )}
                    onClick={toggleRecording}
                    disabled={isLoading}
                    data-testid="button-ai-voice"
                  >
                    {isRecording ? (
                      <MicOff className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                size="icon"
                className="shrink-0"
                data-testid="button-ai-send"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Side Panel for Action Cards (desktop only) */}
        <AnimatePresence>
          {showSidePanel && activeActionMessage && (
            <motion.div
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={cn(
                "w-[360px]",
                "bg-card border border-border rounded-2xl shadow-2xl",
                "flex flex-col overflow-hidden"
              )}
              style={{ maxHeight: 'min(600px, calc(100vh - 10rem))' }}
              data-testid="panel-ai-action"
            >
              <ScrollArea className="flex-1 p-4 overflow-y-auto">
                <ActionCard
                  functionCall={activeActionMessage.functionCall!}
                  onComplete={(success, resultMessage) => {
                    setActionStatuses(prev => ({ ...prev, [activeActionMessage.id]: 'completed' }));
                    if (success) {
                      setMessages(prev => [...prev, {
                        id: nanoid(),
                        role: 'assistant',
                        content: resultMessage,
                        timestamp: new Date(),
                      }]);
                      // Close AI panel after successful action
                      setTimeout(() => onClose(), 500);
                    }
                  }}
                  onDismiss={() => {
                    setActionStatuses(prev => ({ ...prev, [activeActionMessage.id]: 'dismissed' }));
                  }}
                />
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AIMagicHelpModal open={showHelp} onOpenChange={setShowHelp} />
    </>
  );
}

interface MessageBubbleProps {
  message: AIMessage;
  actionStatus?: ActionStatus;
  showActionInline?: boolean;
  onActionComplete?: (success: boolean, message: string) => void;
  onActionDismiss?: () => void;
}

function MessageBubble({ message, actionStatus, showActionInline = true, onActionComplete, onActionDismiss }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  
  if (message.isLoading) {
    return (
      <div className="flex items-start gap-2" data-testid="message-loading">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  const showActionCard = showActionInline && message.functionCall && actionStatus === 'pending' && onActionComplete && onActionDismiss;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col gap-2",
        isUser && "items-end"
      )}
      data-testid={`message-${isUser ? 'user' : 'assistant'}-${message.id}`}
    >
      <div className={cn(
        "flex items-start gap-2",
        isUser && "flex-row-reverse"
      )}>
        <div className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
          isUser 
            ? "bg-primary text-primary-foreground" 
            : "bg-gradient-to-br from-primary to-accent"
        )}>
          {isUser ? (
            <User className="w-3.5 h-3.5" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-white" />
          )}
        </div>
        <div className={cn(
          "rounded-2xl px-4 py-2 max-w-[85%]",
          isUser 
            ? "bg-primary text-primary-foreground rounded-tr-sm" 
            : "bg-muted rounded-tl-sm"
        )}>
          <p 
            className="text-sm whitespace-pre-wrap"
            data-testid={`text-message-${message.id}`}
          >
            {message.content}
          </p>
        </div>
      </div>
      
      {showActionCard && (
        <div className="w-full max-w-[95%] ml-9">
          <ActionCard
            functionCall={message.functionCall!}
            onComplete={onActionComplete}
            onDismiss={onActionDismiss}
          />
        </div>
      )}
    </motion.div>
  );
}
