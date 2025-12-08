import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { isUnauthorizedError } from '@/lib/authUtils';
import TopNavigation from '@/components/top-navigation';
import BottomNav from '@/components/bottom-nav';
import SuperSearch from '@/components/super-search';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Inbox,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  Check,
  RefreshCw,
  Mail,
  User,
  Building2,
  Search,
  Timer,
  CalendarClock,
  Pause,
  Play,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatDistanceToNow, format } from 'date-fns';
import DOMPurify from 'isomorphic-dompurify';

interface EmailThread {
  canonicalConversationId: string;
  subject: string | null;
  participants: string[];
  messageCount: number;
  lastMessageAt: string;
  firstMessageAt: string;
  latestPreview: string | null;
  latestDirection: string | null;
  slaStatus: 'active' | 'complete' | 'snoozed' | null;
  slaBecameActiveAt: string | null;
  slaCompletedAt: string | null;
  slaSnoozeUntil: string | null;
  client: {
    id: string;
    name: string;
  } | null;
  sla: {
    deadline: string;
    isBreached: boolean;
    urgencyLevel: 'ok' | 'warning' | 'danger' | 'breached';
    hoursRemaining: number;
    workingHoursRemaining: number;
  } | null;
}

interface EmailMessage {
  internetMessageId: string;
  subject: string | null;
  from: string;
  to: string[];
  cc: string[] | null;
  body: string;
  bodyPreview: string | null;
  sentDateTime: string;
  receivedDateTime: string;
  direction: string;
  attachments: Array<{
    id: string;
    filename: string;
    contentType: string;
    size: number;
  }>;
}

interface DashboardStats {
  activeCount: number;
  breachedCount: number;
  completeToday: number;
  avgResponseTime: number | null;
  settings: {
    responseDays: number;
    workingDaysOnly: boolean;
    workingHoursStart: string;
    workingHoursEnd: string;
    workingDays: string[];
  };
}

function SlaIndicator({ thread }: { thread: EmailThread }) {
  if (!thread.sla) return null;
  
  const { urgencyLevel, workingHoursRemaining, isBreached } = thread.sla;
  
  let colorClasses = '';
  let Icon = Clock;
  let label = '';
  
  switch (urgencyLevel) {
    case 'breached':
      colorClasses = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      Icon = AlertCircle;
      label = `${Math.abs(workingHoursRemaining).toFixed(1)}h overdue`;
      break;
    case 'danger':
      colorClasses = 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      Icon = AlertTriangle;
      label = `${workingHoursRemaining.toFixed(1)}h left`;
      break;
    case 'warning':
      colorClasses = 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      Icon = Timer;
      label = `${workingHoursRemaining.toFixed(1)}h left`;
      break;
    default:
      colorClasses = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      Icon = Clock;
      label = `${workingHoursRemaining.toFixed(1)}h left`;
  }
  
  return (
    <Badge className={`${colorClasses} flex items-center gap-1 text-xs font-medium`} data-testid="badge-sla-indicator">
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  );
}

function ThreadListItem({
  thread,
  isSelected,
  onClick,
  onMarkComplete
}: {
  thread: EmailThread;
  isSelected: boolean;
  onClick: () => void;
  onMarkComplete: (e: React.MouseEvent) => void;
}) {
  const getDirectionIcon = () => {
    if (thread.latestDirection === 'inbound') {
      return <Mail className="w-4 h-4 text-blue-500" />;
    }
    return <Mail className="w-4 h-4 text-green-500" />;
  };
  
  return (
    <div
      onClick={onClick}
      className={`p-4 border-b cursor-pointer transition-colors hover:bg-muted/50
        ${isSelected ? 'bg-muted border-l-4 border-l-primary' : ''}
        ${thread.sla?.isBreached ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}
      data-testid={`thread-item-${thread.canonicalConversationId}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {getDirectionIcon()}
            <span className="font-medium truncate text-sm" data-testid="text-thread-subject">
              {thread.subject || '(No subject)'}
            </span>
          </div>
          
          <div className="flex items-center gap-2 mb-1">
            {thread.client && (
              <Badge variant="outline" className="text-xs">
                <Building2 className="w-3 h-3 mr-1" />
                {thread.client.name}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {thread.messageCount} message{thread.messageCount !== 1 ? 's' : ''}
            </span>
          </div>
          
          {thread.latestPreview && (
            <p className="text-xs text-muted-foreground truncate">
              {thread.latestPreview}
            </p>
          )}
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}
          </span>
          
          <SlaIndicator thread={thread} />
          
          {thread.slaStatus === 'active' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs hover:bg-green-100 hover:text-green-700"
              onClick={onMarkComplete}
              data-testid={`button-complete-${thread.canonicalConversationId}`}
            >
              <Check className="w-3 h-3 mr-1" />
              Done
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ThreadDetailResponse {
  thread: EmailThread & { slaSnoozeUntil?: string | null };
  messages: EmailMessage[];
}

function ThreadDetail({
  threadId,
  onBack,
  onComplete,
  onSnooze
}: {
  threadId: string;
  onBack: () => void;
  onComplete: () => void;
  onSnooze: (date: Date) => void;
}) {
  const [snoozeDate, setSnoozeDate] = useState<Date | undefined>(undefined);
  const [showSnoozePicker, setShowSnoozePicker] = useState(false);

  const { data, isLoading } = useQuery<ThreadDetailResponse>({
    queryKey: ['/api/email-dashboard/threads', threadId],
    enabled: !!threadId
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Thread not found
      </div>
    );
  }

  const { thread, messages } = data;

  const handleSnooze = () => {
    if (snoozeDate) {
      onSnooze(snoozeDate);
      setShowSnoozePicker(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-4 border-b bg-background sticky top-0 z-10">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        
        <div className="flex-1 min-w-0">
          <h2 className="font-medium truncate" data-testid="text-thread-detail-subject">
            {thread.subject || '(No subject)'}
          </h2>
          {thread.client && (
            <p className="text-sm text-muted-foreground">
              {thread.client.name}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {thread.slaStatus === 'active' && (
            <>
              <Popover open={showSnoozePicker} onOpenChange={setShowSnoozePicker}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-snooze">
                    <Pause className="w-4 h-4 mr-1" />
                    Snooze
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={snoozeDate}
                    onSelect={setSnoozeDate}
                    disabled={(date) => date <= new Date()}
                    initialFocus
                  />
                  <div className="p-2 border-t">
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={!snoozeDate}
                      onClick={handleSnooze}
                      data-testid="button-confirm-snooze"
                    >
                      Snooze until {snoozeDate ? format(snoozeDate, 'MMM d') : '...'}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              
              <Button
                size="sm"
                variant="default"
                className="bg-green-600 hover:bg-green-700"
                onClick={onComplete}
                data-testid="button-mark-complete"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Mark Complete
              </Button>
            </>
          )}
          
          {thread.slaStatus === 'complete' && (
            <Badge className="bg-green-100 text-green-700">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Complete
            </Badge>
          )}
          
          {thread.slaStatus === 'snoozed' && thread.slaSnoozeUntil && (
            <Badge className="bg-purple-100 text-purple-700">
              <Pause className="w-3 h-3 mr-1" />
              Snoozed until {format(new Date(thread.slaSnoozeUntil), 'MMM d')}
            </Badge>
          )}
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message: EmailMessage, index: number) => (
            <Card key={message.internetMessageId} data-testid={`message-${index}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{message.from}</p>
                    <p className="text-xs text-muted-foreground">
                      To: {message.to.join(', ')}
                      {message.cc && message.cc.length > 0 && (
                        <span> | CC: {message.cc.join(', ')}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={message.direction === 'inbound' ? 'default' : 'secondary'} className="text-xs">
                      {message.direction === 'inbound' ? 'Received' : 'Sent'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(message.sentDateTime), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(message.body)
                  }}
                />
                
                {message.attachments.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Attachments ({message.attachments.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {message.attachments.map(att => (
                        <Badge key={att.id} variant="outline" className="text-xs">
                          {att.filename}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function EmailDashboard() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const [activeTab, setActiveTab] = useState<'active' | 'complete' | 'snoozed'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, navigate]);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/email-dashboard/stats']
  });

  const { data: threadsData, isLoading: threadsLoading, refetch: refetchThreads } = useQuery<{ threads: EmailThread[]; total: number }>({
    queryKey: ['/api/email-dashboard/threads', { status: activeTab }]
  });

  const markCompleteMutation = useMutation({
    mutationFn: async (threadId: string) => {
      return apiRequest('PATCH', `/api/email-dashboard/threads/${threadId}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-dashboard/threads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email-dashboard/stats'] });
      toast({
        title: 'Thread marked complete',
        description: 'The email thread has been marked as complete.'
      });
      setSelectedThreadId(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const snoozeMutation = useMutation({
    mutationFn: async ({ threadId, snoozeUntil }: { threadId: string; snoozeUntil: Date }) => {
      return apiRequest('PATCH', `/api/email-dashboard/threads/${threadId}/snooze`, {
        snoozeUntil: snoozeUntil.toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-dashboard/threads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email-dashboard/stats'] });
      toast({
        title: 'Thread snoozed',
        description: 'The thread has been snoozed and will reappear at the scheduled time.'
      });
      setSelectedThreadId(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const filteredThreads = useMemo(() => {
    if (!threadsData?.threads) return [];
    if (!searchQuery.trim()) return threadsData.threads;
    
    const query = searchQuery.toLowerCase();
    return threadsData.threads.filter(thread => 
      thread.subject?.toLowerCase().includes(query) ||
      thread.client?.name.toLowerCase().includes(query) ||
      thread.latestPreview?.toLowerCase().includes(query)
    );
  }, [threadsData?.threads, searchQuery]);

  const handleMarkComplete = useCallback((e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    markCompleteMutation.mutate(threadId);
  }, [markCompleteMutation]);

  const handleSnooze = useCallback((threadId: string, date: Date) => {
    snoozeMutation.mutate({ threadId, snoozeUntil: date });
  }, [snoozeMutation]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation />
      
      <main className="flex-1 container mx-auto px-4 py-6 pb-20 lg:pb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Inbox className="w-6 h-6" />
              Email Dashboard
            </h1>
            <p className="text-muted-foreground">
              Zero-inbox workflow with SLA tracking
            </p>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchThreads()}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Threads</p>
                  <p className="text-2xl font-bold" data-testid="stat-active-count">
                    {statsLoading ? '-' : stats?.activeCount ?? 0}
                  </p>
                </div>
                <Inbox className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className={stats?.breachedCount && stats.breachedCount > 0 ? 'border-red-500' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">SLA Breached</p>
                  <p className="text-2xl font-bold text-red-600" data-testid="stat-breached-count">
                    {statsLoading ? '-' : stats?.breachedCount ?? 0}
                  </p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed Today</p>
                  <p className="text-2xl font-bold text-green-600" data-testid="stat-complete-today">
                    {statsLoading ? '-' : stats?.completeToday ?? 0}
                  </p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Response</p>
                  <p className="text-2xl font-bold" data-testid="stat-avg-response">
                    {statsLoading ? '-' : stats?.avgResponseTime ? `${stats.avgResponseTime.toFixed(1)}h` : 'N/A'}
                  </p>
                </div>
                <Timer className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="h-[calc(100vh-350px)] min-h-[400px]">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search threads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                  data-testid="input-search"
                />
              </div>
            </CardHeader>
            
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <div className="px-4 pb-2">
                <TabsList className="w-full">
                  <TabsTrigger value="active" className="flex-1" data-testid="tab-active">
                    <Inbox className="w-4 h-4 mr-1" />
                    Active
                    {stats?.activeCount ? (
                      <Badge variant="secondary" className="ml-2">
                        {stats.activeCount}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="snoozed" className="flex-1" data-testid="tab-snoozed">
                    <Pause className="w-4 h-4 mr-1" />
                    Snoozed
                  </TabsTrigger>
                  <TabsTrigger value="complete" className="flex-1" data-testid="tab-complete">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Complete
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <CardContent className="p-0 h-[calc(100%-100px)]">
                <ScrollArea className="h-full">
                  {threadsLoading ? (
                    <div className="p-4 space-y-4">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                        </div>
                      ))}
                    </div>
                  ) : filteredThreads.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Inbox className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No threads found</p>
                      {activeTab === 'active' && (
                        <p className="text-sm mt-2">
                          Great job! Your inbox is clear.
                        </p>
                      )}
                    </div>
                  ) : (
                    filteredThreads.map(thread => (
                      <ThreadListItem
                        key={thread.canonicalConversationId}
                        thread={thread}
                        isSelected={selectedThreadId === thread.canonicalConversationId}
                        onClick={() => setSelectedThreadId(thread.canonicalConversationId)}
                        onMarkComplete={(e) => handleMarkComplete(e, thread.canonicalConversationId)}
                      />
                    ))
                  )}
                </ScrollArea>
              </CardContent>
            </Tabs>
          </Card>

          <Card className="h-[calc(100vh-350px)] min-h-[400px]">
            {selectedThreadId ? (
              <ThreadDetail
                threadId={selectedThreadId}
                onBack={() => setSelectedThreadId(null)}
                onComplete={() => markCompleteMutation.mutate(selectedThreadId)}
                onSnooze={(date) => handleSnooze(selectedThreadId, date)}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Mail className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Select a thread to view details</p>
                  <p className="text-sm mt-2">
                    Click on any thread in the list
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </main>
      
      <BottomNav user={user} onSearchClick={() => setMobileSearchOpen(true)} />
      
      <SuperSearch 
        open={mobileSearchOpen} 
        onOpenChange={setMobileSearchOpen} 
      />
    </div>
  );
}
