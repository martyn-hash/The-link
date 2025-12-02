import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Mail,
  Calendar,
  ChevronDown,
  ChevronRight,
  Search,
  RefreshCw,
  Paperclip,
  Video,
  MapPin,
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  FolderOpen,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

interface EligibleUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  accessEmail: boolean;
  accessCalendar: boolean;
}

interface MailFolder {
  id: string;
  displayName: string;
  totalItemCount: number;
  unreadItemCount: number;
}

interface EmailMessage {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      address: string;
      name?: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
  }>;
  receivedDateTime: string;
  hasAttachments: boolean;
  bodyPreview: string;
  isRead: boolean;
  body?: {
    contentType: string;
    content: string;
  };
}

interface CalendarEvent {
  id: string;
  subject: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName: string;
  };
  attendees?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
    type: string;
  }>;
  isOnlineMeeting?: boolean;
  onlineMeeting?: {
    joinUrl: string;
  };
  organizer?: {
    emailAddress: {
      address: string;
      name?: string;
    };
  };
  showAs?: string;
}

export default function GraphTest() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [activeTab, setActiveTab] = useState("emails");
  
  // Email filters
  const [emailFolder, setEmailFolder] = useState<string>("Inbox");
  const [emailStartDate, setEmailStartDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return format(date, 'yyyy-MM-dd');
  });
  const [emailEndDate, setEmailEndDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [emailSearch, setEmailSearch] = useState<string>("");
  const [emailPage, setEmailPage] = useState(0);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  
  // Calendar filters
  const [calendarStartDate, setCalendarStartDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - date.getDay());
    return format(date, 'yyyy-MM-dd');
  });
  const [calendarEndDate, setCalendarEndDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - date.getDay() + 13);
    return format(date, 'yyyy-MM-dd');
  });

  // Redirect if not super admin
  useEffect(() => {
    if (user && !user.superAdmin) {
      navigate("/");
    }
  }, [user, navigate]);

  // Check if Graph API is configured
  const { data: graphStatus, isLoading: graphStatusLoading } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/super-admin/graph/status"],
    enabled: !!user?.superAdmin,
  });

  // Get eligible users
  const { data: eligibleUsers, isLoading: usersLoading } = useQuery<EligibleUser[]>({
    queryKey: ["/api/super-admin/graph/eligible-users"],
    enabled: !!user?.superAdmin && !!graphStatus?.configured,
  });

  // Get mail folders for selected user
  const { data: mailFolders, isLoading: foldersLoading } = useQuery<MailFolder[]>({
    queryKey: ["/api/super-admin/graph/users", selectedUser, "folders"],
    queryFn: async () => {
      if (!selectedUser) return [];
      const res = await fetch(`/api/super-admin/graph/users/${encodeURIComponent(selectedUser)}/folders`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch folders');
      return res.json();
    },
    enabled: !!selectedUser && activeTab === "emails",
  });

  // Get emails for selected user
  const { 
    data: emailsData, 
    isLoading: emailsLoading,
    refetch: refetchEmails,
    isFetching: emailsFetching,
  } = useQuery<{ messages: EmailMessage[]; hasMore: boolean }>({
    queryKey: ["/api/super-admin/graph/users", selectedUser, "messages", emailFolder, emailStartDate, emailEndDate, emailSearch, emailPage],
    queryFn: async () => {
      if (!selectedUser) return { messages: [], hasMore: false };
      const params = new URLSearchParams({
        folder: emailFolder,
        startDate: emailStartDate,
        endDate: emailEndDate,
        top: '25',
        skip: String(emailPage * 25),
      });
      if (emailSearch) params.set('search', emailSearch);
      
      const res = await fetch(`/api/super-admin/graph/users/${encodeURIComponent(selectedUser)}/messages?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch emails');
      return res.json();
    },
    enabled: !!selectedUser && activeTab === "emails",
  });

  // Get single email detail
  const { data: emailDetail, isLoading: emailDetailLoading } = useQuery<EmailMessage>({
    queryKey: ["/api/super-admin/graph/users", selectedUser, "messages", expandedEmailId],
    queryFn: async () => {
      if (!selectedUser || !expandedEmailId) return null;
      const res = await fetch(`/api/super-admin/graph/users/${encodeURIComponent(selectedUser)}/messages/${expandedEmailId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch email');
      return res.json();
    },
    enabled: !!selectedUser && !!expandedEmailId,
  });

  // Get calendar events for selected user
  const { 
    data: calendarData, 
    isLoading: calendarLoading,
    refetch: refetchCalendar,
    isFetching: calendarFetching,
  } = useQuery<{ events: CalendarEvent[]; hasMore: boolean }>({
    queryKey: ["/api/super-admin/graph/users", selectedUser, "calendar", calendarStartDate, calendarEndDate],
    queryFn: async () => {
      if (!selectedUser) return { events: [], hasMore: false };
      const params = new URLSearchParams({
        startDate: calendarStartDate,
        endDate: calendarEndDate,
      });
      
      const res = await fetch(`/api/super-admin/graph/users/${encodeURIComponent(selectedUser)}/calendar?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch calendar');
      return res.json();
    },
    enabled: !!selectedUser && activeTab === "calendar",
  });

  const selectedUserData = eligibleUsers?.find(u => u.email === selectedUser);

  if (!user?.superAdmin) {
    return null;
  }

  if (graphStatusLoading) {
    return (
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!graphStatus?.configured) {
    return (
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardContent className="flex items-center gap-4 py-6">
            <AlertCircle className="h-8 w-8 text-amber-600" />
            <div>
              <h2 className="font-semibold text-lg">Microsoft Graph API Not Configured</h2>
              <p className="text-muted-foreground">
                The required environment variables (MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID) 
                are not set. Please configure these to use this feature.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Mail className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Email / Calendar Test</h1>
          <p className="text-muted-foreground text-sm">
            Explore Microsoft Graph data before deployment (read-only, no data saved)
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Select User</CardTitle>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <Skeleton className="h-10 w-full max-w-md" />
          ) : eligibleUsers && eligibleUsers.length > 0 ? (
            <div className="flex flex-col gap-4">
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="w-full max-w-md" data-testid="select-user">
                  <SelectValue placeholder="Select a user with email/calendar access..." />
                </SelectTrigger>
                <SelectContent>
                  {eligibleUsers.map((u) => (
                    <SelectItem key={u.id} value={u.email} data-testid={`select-user-${u.email}`}>
                      <div className="flex items-center gap-2">
                        <span>{u.firstName} {u.lastName}</span>
                        <span className="text-muted-foreground">({u.email})</span>
                        <div className="flex gap-1 ml-2">
                          {u.accessEmail && <Badge variant="outline" className="text-xs">Email</Badge>}
                          {u.accessCalendar && <Badge variant="outline" className="text-xs">Calendar</Badge>}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedUserData && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>
                    Access enabled: 
                    {selectedUserData.accessEmail && " Email"}
                    {selectedUserData.accessEmail && selectedUserData.accessCalendar && ","}
                    {selectedUserData.accessCalendar && " Calendar"}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              <span>No users have email or calendar access enabled. Enable access in User Management first.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedUser && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger 
              value="emails" 
              disabled={!selectedUserData?.accessEmail}
              className="flex items-center gap-2"
              data-testid="tab-emails"
            >
              <Mail className="h-4 w-4" />
              Emails
            </TabsTrigger>
            <TabsTrigger 
              value="calendar" 
              disabled={!selectedUserData?.accessCalendar}
              className="flex items-center gap-2"
              data-testid="tab-calendar"
            >
              <Calendar className="h-4 w-4" />
              Calendar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="emails">
            <Card>
              <CardHeader className="border-b">
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <Label className="mb-2 block text-sm">Folder</Label>
                    <Select value={emailFolder} onValueChange={(v) => { setEmailFolder(v); setEmailPage(0); }}>
                      <SelectTrigger data-testid="select-folder">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {foldersLoading ? (
                          <SelectItem value="Inbox">Loading...</SelectItem>
                        ) : mailFolders && mailFolders.length > 0 ? (
                          mailFolders.map((folder) => (
                            <SelectItem key={folder.id} value={folder.displayName}>
                              <div className="flex items-center gap-2">
                                <FolderOpen className="h-4 w-4" />
                                <span>{folder.displayName}</span>
                                <span className="text-muted-foreground text-xs">
                                  ({folder.totalItemCount} / {folder.unreadItemCount} unread)
                                </span>
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <>
                            <SelectItem value="Inbox">Inbox</SelectItem>
                            <SelectItem value="SentItems">Sent Items</SelectItem>
                            <SelectItem value="Drafts">Drafts</SelectItem>
                            <SelectItem value="DeletedItems">Deleted Items</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="mb-2 block text-sm">From Date</Label>
                    <Input
                      type="date"
                      value={emailStartDate}
                      onChange={(e) => { setEmailStartDate(e.target.value); setEmailPage(0); }}
                      className="w-40"
                      data-testid="input-email-start-date"
                    />
                  </div>
                  
                  <div>
                    <Label className="mb-2 block text-sm">To Date</Label>
                    <Input
                      type="date"
                      value={emailEndDate}
                      onChange={(e) => { setEmailEndDate(e.target.value); setEmailPage(0); }}
                      className="w-40"
                      data-testid="input-email-end-date"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-[200px]">
                    <Label className="mb-2 block text-sm">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={emailSearch}
                        onChange={(e) => setEmailSearch(e.target.value)}
                        placeholder="Search subject or sender..."
                        className="pl-9"
                        onKeyDown={(e) => { if (e.key === 'Enter') { setEmailPage(0); refetchEmails(); } }}
                        data-testid="input-email-search"
                      />
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    onClick={() => { setEmailPage(0); refetchEmails(); }}
                    disabled={emailsFetching}
                    data-testid="button-refresh-emails"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${emailsFetching ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="p-0">
                {emailsLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : emailsData?.messages && emailsData.messages.length > 0 ? (
                  <ScrollArea className="h-[500px]">
                    <div className="divide-y">
                      {emailsData.messages.map((email) => (
                        <Collapsible
                          key={email.id}
                          open={expandedEmailId === email.id}
                          onOpenChange={(open) => setExpandedEmailId(open ? email.id : null)}
                        >
                          <CollapsibleTrigger asChild>
                            <div 
                              className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${!email.isRead ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
                              data-testid={`email-row-${email.id}`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="pt-1">
                                  {expandedEmailId === email.id ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`font-medium truncate ${!email.isRead ? 'font-semibold' : ''}`}>
                                      {email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Unknown'}
                                    </span>
                                    {email.hasAttachments && (
                                      <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    )}
                                    {!email.isRead && (
                                      <Badge variant="secondary" className="text-xs">Unread</Badge>
                                    )}
                                  </div>
                                  <p className={`text-sm truncate ${!email.isRead ? 'font-medium' : ''}`}>
                                    {email.subject || '(No subject)'}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate mt-1">
                                    {email.bodyPreview}
                                  </p>
                                </div>
                                <div className="text-xs text-muted-foreground whitespace-nowrap">
                                  {format(new Date(email.receivedDateTime), 'MMM d, HH:mm')}
                                </div>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          
                          <CollapsibleContent>
                            <div className="px-4 pb-4 pt-2 bg-muted/30 border-t">
                              {emailDetailLoading && expandedEmailId === email.id ? (
                                <Skeleton className="h-32" />
                              ) : emailDetail && expandedEmailId === email.id ? (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">From: </span>
                                      <span>{emailDetail.from?.emailAddress?.name}</span>
                                      <span className="text-muted-foreground"> &lt;{emailDetail.from?.emailAddress?.address}&gt;</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Date: </span>
                                      {format(new Date(emailDetail.receivedDateTime), 'PPpp')}
                                    </div>
                                    <div className="col-span-2">
                                      <span className="text-muted-foreground">To: </span>
                                      {emailDetail.toRecipients?.map((r, i) => (
                                        <span key={i}>
                                          {i > 0 && ', '}
                                          {r.emailAddress.name || r.emailAddress.address}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  <div className="border rounded-lg bg-white dark:bg-background p-4 max-h-[400px] overflow-auto">
                                    {emailDetail.body?.contentType === 'html' ? (
                                      <div 
                                        dangerouslySetInnerHTML={{ __html: emailDetail.body.content }}
                                        className="prose dark:prose-invert max-w-none text-sm"
                                      />
                                    ) : (
                                      <pre className="whitespace-pre-wrap text-sm font-sans">
                                        {emailDetail.body?.content}
                                      </pre>
                                    )}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <Mail className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No emails found in this date range</p>
                  </div>
                )}
                
                {emailsData && (emailsData.hasMore || emailPage > 0) && (
                  <div className="flex justify-between items-center p-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setEmailPage(p => Math.max(0, p - 1))}
                      disabled={emailPage === 0 || emailsFetching}
                      data-testid="button-prev-page"
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {emailPage + 1}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setEmailPage(p => p + 1)}
                      disabled={!emailsData.hasMore || emailsFetching}
                      data-testid="button-next-page"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar">
            <Card>
              <CardHeader className="border-b">
                <div className="flex flex-wrap gap-4 items-end">
                  <div>
                    <Label className="mb-2 block text-sm">From Date</Label>
                    <Input
                      type="date"
                      value={calendarStartDate}
                      onChange={(e) => setCalendarStartDate(e.target.value)}
                      className="w-40"
                      data-testid="input-calendar-start-date"
                    />
                  </div>
                  
                  <div>
                    <Label className="mb-2 block text-sm">To Date</Label>
                    <Input
                      type="date"
                      value={calendarEndDate}
                      onChange={(e) => setCalendarEndDate(e.target.value)}
                      className="w-40"
                      data-testid="input-calendar-end-date"
                    />
                  </div>
                  
                  <Button
                    variant="outline"
                    onClick={() => refetchCalendar()}
                    disabled={calendarFetching}
                    data-testid="button-refresh-calendar"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${calendarFetching ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="p-0">
                {calendarLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-20" />
                    ))}
                  </div>
                ) : calendarData?.events && calendarData.events.length > 0 ? (
                  <ScrollArea className="h-[500px]">
                    <div className="divide-y">
                      {calendarData.events.map((event) => (
                        <div 
                          key={event.id} 
                          className="p-4 hover:bg-muted/50 transition-colors"
                          data-testid={`calendar-event-${event.id}`}
                        >
                          <div className="flex items-start gap-4">
                            <div className="text-center min-w-[60px]">
                              <div className="text-2xl font-bold text-primary">
                                {format(new Date(event.start.dateTime), 'd')}
                              </div>
                              <div className="text-xs text-muted-foreground uppercase">
                                {format(new Date(event.start.dateTime), 'MMM')}
                              </div>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-medium truncate">{event.subject || '(No title)'}</h3>
                                {event.isOnlineMeeting && (
                                  <Badge variant="secondary" className="flex items-center gap-1">
                                    <Video className="h-3 w-3" />
                                    Teams
                                  </Badge>
                                )}
                                {event.showAs && event.showAs !== 'busy' && (
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {event.showAs}
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  <span>
                                    {format(new Date(event.start.dateTime), 'HH:mm')} - {format(new Date(event.end.dateTime), 'HH:mm')}
                                  </span>
                                </div>
                                
                                {event.location?.displayName && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="h-4 w-4" />
                                    <span className="truncate max-w-[200px]">{event.location.displayName}</span>
                                  </div>
                                )}
                                
                                {event.attendees && event.attendees.length > 0 && (
                                  <div className="flex items-center gap-1">
                                    <Users className="h-4 w-4" />
                                    <span>{event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}</span>
                                  </div>
                                )}
                              </div>
                              
                              {event.onlineMeeting?.joinUrl && (
                                <a
                                  href={event.onlineMeeting.joinUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-primary hover:underline mt-2 inline-block"
                                >
                                  Join Teams Meeting
                                </a>
                              )}
                              
                              {event.organizer && (
                                <div className="text-xs text-muted-foreground mt-2">
                                  Organized by: {event.organizer.emailAddress.name || event.organizer.emailAddress.address}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No calendar events found in this date range</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
