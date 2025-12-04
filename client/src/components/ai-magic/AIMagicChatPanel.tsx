import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
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
import { AIMessage, AIBackendResponse, AIFunctionCall } from './types';
import { AIMagicHelpModal } from './AIMagicHelpModal';
import { ActionCard } from './AIMagicActionCards';
import { nanoid } from 'nanoid';

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

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
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

export function AIMagicChatPanel({ onClose }: AIMagicChatPanelProps) {
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
  
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

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
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: messages
            .filter(m => m.id !== 'welcome' && !m.isLoading)
            .map(m => ({ role: m.role, content: m.content })),
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
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      setInputValue(transcript);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
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

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={cn(
          "fixed bottom-24 left-6 z-50",
          "w-[400px] max-w-[calc(100vw-3rem)]",
          "bg-card border border-border rounded-2xl shadow-2xl",
          "flex flex-col overflow-hidden"
        )}
        style={{ maxHeight: 'calc(100vh - 8rem)' }}
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
          className="flex-1 p-4" 
          style={{ minHeight: '300px', maxHeight: '400px' }}
        >
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble 
                key={message.id} 
                message={message}
                actionStatus={actionStatuses[message.id]}
                onActionComplete={(success, resultMessage) => {
                  setActionStatuses(prev => ({ ...prev, [message.id]: 'completed' }));
                  if (success) {
                    setMessages(prev => [...prev, {
                      id: nanoid(),
                      role: 'assistant',
                      content: resultMessage,
                      timestamp: new Date(),
                    }]);
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

        <div className="p-3 border-t border-border bg-muted/20">
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

      <AIMagicHelpModal open={showHelp} onOpenChange={setShowHelp} />
    </>
  );
}

interface MessageBubbleProps {
  message: AIMessage;
  actionStatus?: ActionStatus;
  onActionComplete?: (success: boolean, message: string) => void;
  onActionDismiss?: () => void;
}

function MessageBubble({ message, actionStatus, onActionComplete, onActionDismiss }: MessageBubbleProps) {
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

  const showActionCard = message.functionCall && actionStatus === 'pending' && onActionComplete && onActionDismiss;

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
