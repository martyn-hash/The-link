import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MessagesModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MessageThread {
  id: string;
  topic: string;
  createdAt: Date;
  lastMessageAt: Date;
  creator: {
    id: string;
    firstName: string;
    lastName: string;
  };
  participants: Array<{
    id: string;
    firstName: string;
    lastName: string;
  }>;
}

interface Message {
  id: string;
  content: string;
  createdAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export function MessagesModal({
  projectId,
  open,
  onOpenChange,
}: MessagesModalProps) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const { toast } = useToast();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Fetch project message threads with infinite scroll
  const {
    data: threadsData,
    isLoading: isLoadingThreads,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['/api/internal/project-messages/threads', projectId],
    queryFn: async ({ pageParam = undefined }) => {
      const params = new URLSearchParams();
      params.append('limit', '5');
      if (pageParam) {
        params.append('cursor', pageParam);
      }
      const response = await fetch(`/api/internal/project-messages/threads/${projectId}?${params}`);
      if (!response.ok) throw new Error('Failed to fetch threads');
      return response.json();
    },
    getNextPageParam: (lastPage) => lastPage.pagination?.nextCursor ?? undefined,
    enabled: open && !!projectId,
    initialPageParam: undefined as string | undefined,
  });

  // Flatten all pages of threads
  const threads = threadsData?.pages.flatMap((page) => page.threads) ?? [];

  // IntersectionObserver to trigger loading more threads
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Fetch messages for selected thread
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: ['/api/internal/project-messages/threads', selectedThreadId, 'messages'],
    enabled: open && !!selectedThreadId,
    staleTime: 30000,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ threadId, content }: { threadId: string; content: string }) => {
      return await apiRequest({
        url: `/api/internal/project-messages/threads/${threadId}/messages`,
        method: 'POST',
        data: { content },
      });
    },
    onSuccess: (_, variables) => {
      // Invalidate messages query to refresh the thread
      queryClient.invalidateQueries({
        queryKey: ['/api/internal/project-messages/threads', variables.threadId, 'messages'],
      });
      // Invalidate threads query to update lastMessageAt
      queryClient.invalidateQueries({
        queryKey: ['/api/internal/project-messages/threads', projectId],
      });
      setReplyContent("");
      toast({
        title: "Message sent",
        description: "Your message has been sent successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!selectedThreadId || !replyContent.trim()) return;
    sendMessageMutation.mutate({
      threadId: selectedThreadId,
      content: replyContent.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Project Messages</DialogTitle>
        </DialogHeader>

        {isLoadingThreads ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No message threads for this project</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden">
            {/* Thread List */}
            <div className="flex flex-col border-r pr-4">
              <h3 className="text-sm font-semibold mb-3">Threads</h3>
              <ScrollArea className="flex-1">
                <div className="space-y-2">
                  {threads.map((thread) => (
                    <Card
                      key={thread.id}
                      className={`cursor-pointer transition-colors hover:bg-accent ${
                        selectedThreadId === thread.id ? 'bg-accent' : ''
                      }`}
                      onClick={() => setSelectedThreadId(thread.id)}
                      data-testid={`thread-card-${thread.id}`}
                    >
                      <CardHeader className="p-3 space-y-1">
                        <CardTitle className="text-sm font-medium" data-testid="text-thread-topic">
                          {thread.topic}
                        </CardTitle>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span data-testid="text-thread-creator">
                            {thread.creator.firstName} {thread.creator.lastName}
                          </span>
                          <span>•</span>
                          <span data-testid="text-thread-date">
                            {format(new Date(thread.lastMessageAt), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {thread.participants.slice(0, 3).map((participant: any) => (
                            <Badge key={participant.id} variant="secondary" className="text-xs">
                              {participant.firstName[0]}{participant.lastName[0]}
                            </Badge>
                          ))}
                          {thread.participants.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{thread.participants.length - 3}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                  
                  {/* IntersectionObserver sentinel for infinite scroll */}
                  {hasNextPage && (
                    <div ref={loadMoreRef} className="py-4 text-center">
                      {isFetchingNextPage ? (
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      ) : (
                        <div className="h-4" /> 
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Messages and Reply */}
            <div className="flex flex-col">
              {!selectedThreadId ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Select a thread to view messages
                </div>
              ) : (
                <>
                  <h3 className="text-sm font-semibold mb-3">Messages</h3>
                  
                  {/* Messages List */}
                  <ScrollArea className="flex-1 mb-4">
                    {isLoadingMessages ? (
                      <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
                        No messages in this thread
                      </div>
                    ) : (
                      <div className="space-y-3 pr-2">
                        {messages.map((message) => (
                          <div key={message.id} className="space-y-1" data-testid={`message-${message.id}`}>
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-medium" data-testid="text-message-author">
                                {message.user.firstName} {message.user.lastName}
                              </span>
                              <span className="text-xs text-muted-foreground" data-testid="text-message-date">
                                {format(new Date(message.createdAt), 'MMM d, h:mm a')}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap" data-testid="text-message-content">
                              {message.content}
                            </p>
                            <Separator className="mt-2" />
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>

                  {/* Quick Reply */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Quick Reply</label>
                    <Textarea
                      placeholder="Type your message..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      className="resize-none"
                      rows={3}
                      data-testid="textarea-reply"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!replyContent.trim() || sendMessageMutation.isPending}
                      className="w-full"
                      data-testid="button-send-message"
                    >
                      {sendMessageMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
