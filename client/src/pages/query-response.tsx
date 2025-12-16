import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { useSwipeable } from "react-swipeable";
import confetti from "canvas-confetti";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import logoPath from "@assets/full_logo_transparent_600_1761924125378.png";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  ArrowRight,
  Send,
  Calendar,
  FileText,
  PoundSterling,
  ChevronDown,
  ChevronUp,
  Loader2,
  XCircle,
  HelpCircle,
  MessageSquare,
  Hand,
  Paperclip,
  Upload,
  X,
  File,
  Image,
  Save,
  Cloud,
  CloudOff,
  Check,
  Folder,
  PartyPopper,
  Sparkles,
} from "lucide-react";

interface QueryAttachment {
  objectPath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

interface QueryGroup {
  id: string;
  groupName: string;
  description: string | null;
}

interface Query {
  id: string;
  date: string | null;
  description: string | null;
  moneyIn: string | null;
  moneyOut: string | null;
  hasVat: boolean | null;
  ourQuery: string;
  clientResponse: string | null;
  clientAttachments: QueryAttachment[] | null;
  status: string;
  groupId: string | null;
  group: QueryGroup | null;
}

interface TokenData {
  tokenId: string;
  projectId: string;
  projectDescription: string | null;
  clientName: string | null;
  recipientName: string | null;
  recipientEmail: string;
  queryCount: number;
  expiresAt: string;
  queries: Query[];
}

interface QueryResponse {
  queryId: string;
  clientResponse: string;
  hasVat: boolean | null;
  attachments?: QueryAttachment[];
}

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

const CARD_BACKGROUND_COLORS = [
  'bg-blue-50/70',
  'bg-green-50/70',
  'bg-amber-50/70',
  'bg-rose-50/70',
];

interface DisplayItem {
  type: 'single' | 'group';
  id: string;
  groupName?: string;
  groupDescription?: string | null;
  queries: Query[];
  primaryQueryId: string;
}

function groupQueriesForDisplay(queries: Query[]): DisplayItem[] {
  const groupedMap = new Map<string | null, Query[]>();
  
  for (const query of queries) {
    const key = query.groupId;
    if (!groupedMap.has(key)) {
      groupedMap.set(key, []);
    }
    groupedMap.get(key)!.push(query);
  }
  
  const displayItems: DisplayItem[] = [];
  
  const sortedKeys = Array.from(groupedMap.keys()).sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return 0;
  });
  
  for (const key of sortedKeys) {
    const groupQueries = groupedMap.get(key)!;
    if (key === null) {
      for (const query of groupQueries) {
        displayItems.push({
          type: 'single',
          id: query.id,
          queries: [query],
          primaryQueryId: query.id,
        });
      }
    } else {
      displayItems.push({
        type: 'group',
        id: key,
        groupName: groupQueries[0].group?.groupName || 'Group',
        groupDescription: groupQueries[0].group?.description,
        queries: groupQueries,
        primaryQueryId: groupQueries[0].id,
      });
    }
  }
  
  return displayItems;
}

interface ExpiredLinkViewProps {
  isCompleted: boolean;
  isExpired: boolean;
  expiresAt?: string;
  tokenId?: string;
  projectId?: string;
  createdById?: string;
  canRequestNewLink: boolean;
}

function ExpiredLinkView({ 
  isCompleted, 
  isExpired, 
  expiresAt, 
  tokenId, 
  projectId, 
  createdById,
  canRequestNewLink 
}: ExpiredLinkViewProps) {
  const { toast } = useToast();
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const formattedExpiryDate = expiresAt 
    ? format(new Date(expiresAt), "d MMMM yyyy 'at' h:mm a")
    : null;

  const handleRequestNewLink = async () => {
    if (!tokenId || !projectId || !createdById) return;
    
    setIsRequesting(true);
    try {
      const response = await fetch('/api/query-response/request-new-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId, projectId, createdById }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setRequestSent(true);
        toast({
          title: "Request Sent!",
          description: "Your accountant has been notified and will send you a new link soon.",
        });
      } else {
        toast({
          title: "Couldn't send request",
          description: result.message || "Please try again or contact your accountant directly.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Something went wrong",
        description: "Please try again or contact your accountant directly.",
        variant: "destructive",
      });
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center">
          <div className={cn(
            "w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center",
            isCompleted ? "bg-green-100" : "bg-red-100"
          )}>
            {isCompleted ? (
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            ) : isExpired ? (
              <Clock className="w-8 h-8 text-red-600" />
            ) : (
              <XCircle className="w-8 h-8 text-red-600" />
            )}
          </div>
          <h2 className="text-xl font-semibold mb-2">
            {isCompleted ? "All Done!" : isExpired ? "Oh no!" : "Oh no!"}
          </h2>
          <p className="text-muted-foreground mb-4">
            {isCompleted 
              ? "Thank you! Your responses have already been submitted successfully."
              : isExpired && formattedExpiryDate
                ? `This link expired on ${formattedExpiryDate}.`
                : isExpired
                  ? "This link has expired."
                  : "This link doesn't work any more, but please contact us if you need some assistance."
            }
          </p>
          
          {canRequestNewLink && !requestSent && (
            <Button
              onClick={handleRequestNewLink}
              disabled={isRequesting}
              className="w-full mb-4"
              data-testid="button-request-new-link"
            >
              {isRequesting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Requesting...
                </>
              ) : (
                "Request a New Link"
              )}
            </Button>
          )}
          
          {requestSent && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Request sent!</span>
              </div>
              <p className="text-sm text-green-600 mt-1">
                Your accountant has been notified and will send you a new link soon.
              </p>
            </div>
          )}
          
          <p className="text-sm text-muted-foreground">
            {isCompleted 
              ? "You can close this page now."
              : "Need help? Just get in touch with your accountant."
            }
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function QueryResponsePage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [responses, setResponses] = useState<Record<string, QueryResponse>>({});
  const [isPulsing, setIsPulsing] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'unanswered'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
  const [showCelebration, setShowCelebration] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const hasTriggeredConfetti = useRef(false);
  const hasDismissedCelebration = useRef(false);
  const saveTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const DEBOUNCE_MS = 1500; // Auto-save after 1.5 seconds of no typing

  const triggerConfetti = useCallback(() => {
    if (hasTriggeredConfetti.current) return;
    hasTriggeredConfetti.current = true;
    
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        return clearInterval(interval);
      }
      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  }, []);

  const { data, isLoading, error, isError } = useQuery<TokenData>({
    queryKey: ['/api/query-response', token],
    enabled: !!token,
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: async (responses: QueryResponse[]) => {
      const response = await fetch(`/api/query-response/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit responses');
      }
      return response.json();
    },
    onSuccess: () => {
      setIsSubmitted(true);
    },
    onError: (error: Error) => {
      // Show a friendly error message - never show technical jargon to clients
      let friendlyDescription = error.message;
      
      // Map any remaining technical messages to friendly language
      if (error.message.toLowerCase().includes('invalid') || 
          error.message.toLowerCase().includes('validation') ||
          error.message.toLowerCase().includes('failed')) {
        friendlyDescription = "Please check all your answers and try again. If the problem continues, refresh the page.";
      } else if (error.message.includes('expired')) {
        friendlyDescription = "This link has expired. Please contact your accountant for a new link.";
      } else if (error.message.includes('already submitted')) {
        friendlyDescription = "Your responses have already been submitted. No further action is needed.";
      }
      
      toast({
        title: "Just a moment...",
        description: friendlyDescription,
      });
    },
  });

  // Auto-save mutation for individual queries
  const autoSaveMutation = useMutation({
    mutationFn: async ({ queryId, data }: { queryId: string; data: Partial<QueryResponse> }) => {
      const response = await fetch(`/api/query-response/${token}/queries/${queryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientResponse: data.clientResponse,
          hasVat: data.hasVat,
          attachments: data.attachments,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save response');
      }
      return { queryId, ...(await response.json()) };
    },
    onMutate: ({ queryId }) => {
      setSaveStatus(prev => ({ ...prev, [queryId]: 'saving' }));
    },
    onSuccess: ({ queryId }) => {
      setSaveStatus(prev => ({ ...prev, [queryId]: 'saved' }));
    },
    onError: (error: Error, { queryId }) => {
      setSaveStatus(prev => ({ ...prev, [queryId]: 'error' }));
      console.error('Auto-save failed:', error.message);
      toast({
        variant: "destructive",
        title: "Couldn't save your response",
        description: "Please check your connection and try again. Your changes may not be saved.",
      });
    },
  });

  // Debounced auto-save function
  const debouncedSave = useCallback((queryId: string, data: Partial<QueryResponse>) => {
    // Clear any existing timeout for this query
    if (saveTimeouts.current[queryId]) {
      clearTimeout(saveTimeouts.current[queryId]);
    }

    // Mark as unsaved immediately
    setSaveStatus(prev => ({ ...prev, [queryId]: 'unsaved' }));

    // Set new timeout
    saveTimeouts.current[queryId] = setTimeout(() => {
      autoSaveMutation.mutate({ queryId, data });
    }, DEBOUNCE_MS);
  }, [autoSaveMutation, DEBOUNCE_MS]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(saveTimeouts.current).forEach(clearTimeout);
    };
  }, []);

  // Pulse animation when swiping between cards (triggered by currentItemId change)

  // Sanitize attachments to ensure they have all required fields
  const sanitizeAttachments = (attachments: QueryAttachment[] | null | undefined): QueryAttachment[] => {
    if (!attachments || !Array.isArray(attachments)) return [];
    return attachments
      .filter(a => a && typeof a === 'object' && a.objectPath && a.fileName)
      .map(a => ({
        objectPath: a.objectPath,
        fileName: a.fileName,
        fileType: a.fileType || 'application/octet-stream',
        fileSize: typeof a.fileSize === 'number' ? a.fileSize : 0,
        uploadedAt: a.uploadedAt || new Date().toISOString(),
      }));
  };

  useEffect(() => {
    if (data?.queries) {
      const initialResponses: Record<string, QueryResponse> = {};
      const initialSaveStatus: Record<string, SaveStatus> = {};
      let hasSavedResponses = false;
      
      data.queries.forEach(q => {
        initialResponses[q.id] = {
          queryId: q.id,
          clientResponse: q.clientResponse || '',
          hasVat: q.hasVat,
          attachments: sanitizeAttachments(q.clientAttachments),
        };
        if (q.clientResponse || q.clientAttachments?.length) {
          initialSaveStatus[q.id] = 'saved';
          hasSavedResponses = true;
        }
      });
      setResponses(initialResponses);
      setSaveStatus(initialSaveStatus);
      
      if (hasSavedResponses) {
        setShowWelcomeBack(true);
        setTimeout(() => setShowWelcomeBack(false), 4000);
      }
    }
  }, [data]);

  // Group queries for display - groups become single display items
  const allDisplayItems = useMemo(() => {
    if (!data?.queries) return [];
    return groupQueriesForDisplay(data.queries);
  }, [data?.queries]);

  const allQueriesAnswered = useMemo(() => {
    if (allDisplayItems.length === 0) return false;
    return allDisplayItems.every(item => {
      const response = responses[item.primaryQueryId];
      return !!(response?.clientResponse?.trim() || (response?.attachments && response.attachments.length > 0));
    });
  }, [allDisplayItems, responses]);

  // Track if user has started answering (to prevent celebration on initial load)
  const hasUserStartedAnswering = useRef(false);
  
  // Reset celebration dismissal flag when not all queries are answered
  // Celebration is now triggered explicitly by navigation, not automatically by auto-save
  useEffect(() => {
    if (!allQueriesAnswered) {
      hasDismissedCelebration.current = false;
      hasTriggeredConfetti.current = false;
    }
  }, [allQueriesAnswered]);
  
  // Function to show celebration screen with confetti
  // Called by navigateNext when no more unanswered items remain - trust the caller
  const showCelebrationScreen = useCallback(() => {
    if (allDisplayItems.length > 0 && !isSubmitted && !hasDismissedCelebration.current) {
      setShowCelebration(true);
      triggerConfetti();
    }
  }, [allDisplayItems.length, isSubmitted, triggerConfetti]);
  
  // Celebration is now triggered ONLY by explicit user action (Next button click)
  // via showCelebrationScreen() in navigateNext - no auto-trigger on typing

  // Helper to check if an item is answered (has text response OR attachments)
  const isItemAnswered = useCallback((item: DisplayItem) => {
    const response = responses[item.primaryQueryId];
    return !!(response?.clientResponse?.trim() || (response?.attachments && response.attachments.length > 0));
  }, [responses]);

  // Simple approach: Track which item ID we're viewing, and keep it visible regardless of filter
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
  
  // Check if there are any unanswered items
  const hasUnansweredItems = useMemo(() => {
    return allDisplayItems.some(item => !isItemAnswered(item));
  }, [allDisplayItems, isItemAnswered]);
  
  // Filter display items based on filter mode
  // Include current item while editing, but show empty state when ALL items are answered
  const displayItems = useMemo(() => {
    if (filterMode === 'all') return allDisplayItems;
    
    // If all items are answered, return empty array to show "All queries answered" state
    if (!hasUnansweredItems) return [];
    
    // In unanswered mode, show unanswered items + current item (to prevent disappearing while typing)
    return allDisplayItems.filter(item => 
      !isItemAnswered(item) || item.primaryQueryId === currentItemId
    );
  }, [allDisplayItems, filterMode, isItemAnswered, currentItemId, hasUnansweredItems]);

  // Count of unanswered items (real-time for accurate display in filter buttons)
  const unansweredCount = useMemo(() => {
    return allDisplayItems.filter(item => !isItemAnswered(item)).length;
  }, [allDisplayItems, isItemAnswered]);
  
  // Find the current item's index in the display list
  const currentIndex = useMemo(() => {
    if (!currentItemId) return 0;
    const idx = displayItems.findIndex(item => item.primaryQueryId === currentItemId);
    return idx >= 0 ? idx : 0;
  }, [displayItems, currentItemId]);
  
  // Pulse animation when navigating between cards
  useEffect(() => {
    setIsPulsing(true);
    const timer = setTimeout(() => setIsPulsing(false), 400);
    return () => clearTimeout(timer);
  }, [currentItemId]);
  
  // Initialize currentItemId when data loads or filter changes
  useEffect(() => {
    if (displayItems.length > 0 && !currentItemId) {
      setCurrentItemId(displayItems[0].primaryQueryId);
    }
  }, [displayItems, currentItemId]);
  
  // Track filter mode changes to intelligently update current item
  const prevFilterModeRef = useRef(filterMode);
  
  useEffect(() => {
    const prevMode = prevFilterModeRef.current;
    prevFilterModeRef.current = filterMode;
    
    // Only update on actual filter change, not on every render
    if (prevMode === filterMode) return;
    
    if (filterMode === 'all') {
      // Switching to "all" mode - try to keep current position if item exists
      if (currentItemId) {
        const existsInAll = allDisplayItems.some(item => item.primaryQueryId === currentItemId);
        if (existsInAll) return; // Keep current position
      }
      // Fall back to first item
      if (allDisplayItems.length > 0) {
        setCurrentItemId(allDisplayItems[0].primaryQueryId);
      }
    } else {
      // Switching to "unanswered" mode
      // If current item is unanswered, keep it
      if (currentItemId) {
        const currentItem = allDisplayItems.find(item => item.primaryQueryId === currentItemId);
        if (currentItem && !isItemAnswered(currentItem)) return; // Keep current position
      }
      // Otherwise, find first unanswered
      const firstUnanswered = allDisplayItems.find(item => !isItemAnswered(item));
      if (firstUnanswered) {
        setCurrentItemId(firstUnanswered.primaryQueryId);
      } else {
        // No unanswered items remain - set to null for empty state
        setCurrentItemId(null);
      }
    }
  }, [filterMode, allDisplayItems, currentItemId, isItemAnswered]);
  
  // Navigation helpers - navigate by finding next/prev unanswered item in sequence
  const navigateNext = useCallback(() => {
    // Guard: Don't navigate when in empty state
    if (displayItems.length === 0) return;
    
    if (filterMode === 'unanswered') {
      // Find current item's position in the full list
      const currentAllIdx = allDisplayItems.findIndex(item => item.primaryQueryId === currentItemId);
      if (currentAllIdx === -1) return; // Guard: current item not found
      
      // Look for the next unanswered item AFTER current position
      for (let i = currentAllIdx + 1; i < allDisplayItems.length; i++) {
        if (!isItemAnswered(allDisplayItems[i])) {
          setCurrentItemId(allDisplayItems[i].primaryQueryId);
          return;
        }
      }
      
      // No more unanswered items after current - wrap to find first unanswered before current
      for (let i = 0; i < currentAllIdx; i++) {
        if (!isItemAnswered(allDisplayItems[i])) {
          setCurrentItemId(allDisplayItems[i].primaryQueryId);
          return;
        }
      }
      
      // All items are answered - show celebration if eligible
      showCelebrationScreen();
    } else {
      // In "all" mode, just move to next index
      if (currentIndex < displayItems.length - 1) {
        setCurrentItemId(displayItems[currentIndex + 1].primaryQueryId);
      } else {
        // On the last item - check if all are answered and show celebration
        showCelebrationScreen();
      }
    }
  }, [allDisplayItems, displayItems, currentIndex, currentItemId, filterMode, isItemAnswered, showCelebrationScreen]);
  
  const navigatePrev = useCallback(() => {
    // Guard: Don't navigate when in empty state
    if (displayItems.length === 0) return;
    
    if (filterMode === 'unanswered') {
      // Find current item's position in the full list
      const currentAllIdx = allDisplayItems.findIndex(item => item.primaryQueryId === currentItemId);
      if (currentAllIdx === -1) return; // Guard: current item not found
      
      // Look for the prev unanswered item BEFORE current position
      for (let i = currentAllIdx - 1; i >= 0; i--) {
        if (!isItemAnswered(allDisplayItems[i])) {
          setCurrentItemId(allDisplayItems[i].primaryQueryId);
          return;
        }
      }
      
      // No more unanswered items before current - wrap to find last unanswered after current
      for (let i = allDisplayItems.length - 1; i > currentAllIdx; i--) {
        if (!isItemAnswered(allDisplayItems[i])) {
          setCurrentItemId(allDisplayItems[i].primaryQueryId);
          return;
        }
      }
      
      // All items are answered - stay on current item
    } else {
      // In "all" mode, just move to prev index
      if (currentIndex > 0) {
        setCurrentItemId(displayItems[currentIndex - 1].primaryQueryId);
      }
    }
  }, [allDisplayItems, displayItems, currentIndex, currentItemId, filterMode, isItemAnswered]);

  // Swipe handlers - now work with display items instead of individual queries
  const displayItemCount = displayItems.length;
  const totalQueryCount = data?.queries?.length || 0;
  
  // Ref to track if we should allow swipe (disabled when inside input/textarea)
  const allowSwipeRef = useRef(true);
  
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (allowSwipeRef.current && currentIndex < displayItemCount - 1) {
        navigateNext();
      }
    },
    onSwipedRight: () => {
      if (allowSwipeRef.current && currentIndex > 0) {
        navigatePrev();
      }
    },
    onSwiping: (e) => {
      // Check if swiping started on an input element
      const target = e.event.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.closest('textarea, input')) {
        allowSwipeRef.current = false;
      }
    },
    onTouchStartOrOnMouseDown: (e) => {
      // Reset swipe allowance on new touch/click
      const target = e.event.target as HTMLElement;
      allowSwipeRef.current = !(target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.closest('textarea, input'));
    },
    preventScrollOnSwipe: false, // Allow normal scroll behavior
    trackMouse: false,
    trackTouch: true,
    delta: 80, // Increase threshold to avoid accidental triggers
  });

  const updateResponse = (queryId: string, field: 'clientResponse' | 'hasVat', value: string | boolean | null) => {
    hasUserStartedAnswering.current = true;
    setResponses(prev => {
      const updated = {
        ...prev,
        [queryId]: {
          ...prev[queryId],
          [field]: value,
        },
      };
      // Trigger auto-save with the updated data
      debouncedSave(queryId, updated[queryId]);
      return updated;
    });
  };

  const addAttachment = (queryId: string, attachment: QueryAttachment) => {
    hasUserStartedAnswering.current = true;
    setResponses(prev => {
      const updated = {
        ...prev,
        [queryId]: {
          ...prev[queryId],
          attachments: [...(prev[queryId]?.attachments || []), attachment],
        },
      };
      // Save immediately for attachments (already uploaded, no debounce needed)
      autoSaveMutation.mutate({ queryId, data: updated[queryId] });
      return updated;
    });
  };

  const removeAttachment = (queryId: string, objectPath: string) => {
    setResponses(prev => {
      const updated = {
        ...prev,
        [queryId]: {
          ...prev[queryId],
          attachments: prev[queryId]?.attachments?.filter(a => a.objectPath !== objectPath) || [],
        },
      };
      // Save immediately when removing attachment
      autoSaveMutation.mutate({ queryId, data: updated[queryId] });
      return updated;
    });
  };

  const handleFileUpload = async (queryId: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB",
        variant: "destructive",
      });
      return;
    }

    setUploadingFiles(prev => ({ ...prev, [queryId]: true }));

    try {
      const uploadUrlResponse = await fetch(`/api/query-response/${token}/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          queryId,
        }),
      });

      if (!uploadUrlResponse.ok) {
        const error = await uploadUrlResponse.json();
        throw new Error(error.message || 'Failed to get upload URL');
      }

      const { url, objectPath, fileName } = await uploadUrlResponse.json();

      const uploadResponse = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      addAttachment(queryId, {
        objectPath,
        fileName,
        fileType: file.type,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : 'Failed to upload file',
        variant: "destructive",
      });
    } finally {
      setUploadingFiles(prev => ({ ...prev, [queryId]: false }));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const handleSubmit = () => {
    // Check for unanswered display items - always check ALL items regardless of current filter
    const unansweredItems: { index: number; name: string; item: DisplayItem }[] = [];
    allDisplayItems.forEach((item, index) => {
      const primaryResponse = responses[item.primaryQueryId];
      const hasResponse = primaryResponse?.clientResponse?.trim();
      const hasAttachments = (primaryResponse?.attachments?.length ?? 0) > 0;
      if (!hasResponse && !hasAttachments) {
        const name = item.type === 'group' 
          ? item.groupName || 'Group'
          : item.queries[0]?.description || item.queries[0]?.ourQuery?.slice(0, 30) || 'Transaction';
        unansweredItems.push({ index: index + 1, name, item });
      }
    });

    if (unansweredItems.length > 0) {
      const firstUnansweredItem = unansweredItems[0].item;
      if (unansweredItems.length === 1) {
        const q = unansweredItems[0];
        toast({
          title: "Almost there! One more answer needed",
          description: `Please answer "${q.name}" before submitting.`,
        });
        setCurrentItemId(firstUnansweredItem.primaryQueryId);
        setFilterMode('all'); // Switch to all mode to show the item
      } else if (unansweredItems.length <= 3) {
        toast({
          title: `${unansweredItems.length} more answers needed`,
          description: `Please answer all items before submitting.`,
        });
        setCurrentItemId(firstUnansweredItem.primaryQueryId);
        setFilterMode('all'); // Switch to all mode to show the item
      } else {
        toast({
          title: `${unansweredItems.length} more answers needed`,
          description: `Please answer all items before submitting.`,
        });
        setCurrentItemId(firstUnansweredItem.primaryQueryId);
        setFilterMode('all'); // Switch to all mode to show the item
      }
      return;
    }

    // Build response array from ALL items, copying group responses to all queries in the group
    // Use responses object for group responses, but also check original query data for any responses
    // that may not have been visited (pre-populated from server)
    const responseArray: QueryResponse[] = [];
    for (const item of allDisplayItems) {
      const primaryResponse = responses[item.primaryQueryId];
      for (const query of item.queries) {
        // Get the response from state if available, otherwise use empty defaults
        const existingQueryResponse = responses[query.id];
        const isPrimary = query.id === item.primaryQueryId;
        
        responseArray.push({
          queryId: query.id,
          // For non-primary queries in group, use primary response; otherwise use query's own response
          clientResponse: isPrimary 
            ? (primaryResponse?.clientResponse || existingQueryResponse?.clientResponse || '')
            : (primaryResponse?.clientResponse || ''),
          hasVat: isPrimary 
            ? (primaryResponse?.hasVat ?? existingQueryResponse?.hasVat ?? null)
            : (primaryResponse?.hasVat ?? null),
          // Only include attachments for primary query
          attachments: isPrimary ? (primaryResponse?.attachments || existingQueryResponse?.attachments || []) : undefined,
        });
      }
    }
    submitMutation.mutate(responseArray);
  };

  const answeredCount = Object.values(responses).filter(r => r.clientResponse?.trim()).length;
  const progress = totalQueryCount > 0 ? (answeredCount / totalQueryCount) * 100 : 0;
  
  // Count display items that have been answered (for groups, check if the primary query has a response)
  const answeredDisplayItemCount = displayItems.filter(item => {
    const primaryResponse = responses[item.primaryQueryId];
    return primaryResponse?.clientResponse?.trim() || (primaryResponse?.attachments?.length ?? 0) > 0;
  }).length;

  const formatDate = (date: string | null) => {
    if (!date) return null;
    try {
      return format(new Date(date), 'dd MMM yyyy');
    } catch {
      return date;
    }
  };

  const formatAmount = (moneyIn: string | null, moneyOut: string | null) => {
    if (moneyIn && parseFloat(moneyIn) > 0) {
      return { amount: `£${parseFloat(moneyIn).toFixed(2)}`, type: 'in' as const };
    }
    if (moneyOut && parseFloat(moneyOut) > 0) {
      return { amount: `£${parseFloat(moneyOut).toFixed(2)}`, type: 'out' as const };
    }
    return null;
  };

  // Save status indicator component
  const SaveStatusIndicator = ({ queryId }: { queryId: string }) => {
    const status = saveStatus[queryId];
    
    if (!status) return null;
    
    switch (status) {
      case 'saving':
        return (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Saving...</span>
          </div>
        );
      case 'saved':
        return (
          <div className="flex items-center gap-1.5 text-xs text-green-600">
            <Cloud className="w-3 h-3" />
            <span>Saved</span>
          </div>
        );
      case 'unsaved':
        return (
          <div className="flex items-center gap-1.5 text-xs text-amber-600">
            <CloudOff className="w-3 h-3" />
            <span>Unsaved</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle className="w-3 h-3" />
            <span>Save failed</span>
          </div>
        );
      default:
        return null;
    }
  };

  // Count of saved responses for progress display
  const savedCount = Object.values(saveStatus).filter(s => s === 'saved').length;

  // Global save status for header display - must be before early returns
  const globalSaveStatus = useMemo(() => {
    const statuses = Object.values(saveStatus);
    if (statuses.length === 0) return null;
    if (statuses.some(s => s === 'error')) return 'error';
    if (statuses.some(s => s === 'saving')) return 'saving';
    if (statuses.some(s => s === 'unsaved')) return 'unsaved';
    if (statuses.every(s => s === 'saved')) return 'saved';
    return null;
  }, [saveStatus]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <img src={logoPath} alt="Logo" className="h-12 mx-auto mb-4 animate-pulse" />
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-2">Loading your queries...</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    // Parse the error response - the queryClient throws errors like "400: {...json...}"
    let errorData: any = {};
    try {
      const errorMessage = (error as Error)?.message || '';
      const jsonStartIndex = errorMessage.indexOf('{');
      if (jsonStartIndex !== -1) {
        errorData = JSON.parse(errorMessage.substring(jsonStartIndex));
      }
    } catch {
      // If parsing fails, use empty object
    }
    
    const isExpired = errorData?.expired;
    const isCompleted = errorData?.completed;
    const expiresAt = errorData?.expiresAt;
    const tokenId = errorData?.tokenId;
    const projectId = errorData?.projectId;
    const createdById = errorData?.createdById;
    
    // Can request a new link if we have the necessary token info
    const canRequestNewLink = isExpired && tokenId && projectId && createdById;

    return (
      <ExpiredLinkView 
        isCompleted={isCompleted}
        isExpired={isExpired}
        expiresAt={expiresAt}
        tokenId={tokenId}
        projectId={projectId}
        createdById={createdById}
        canRequestNewLink={canRequestNewLink}
      />
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 mx-auto mb-6 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-800 mb-2">Thank You!</h2>
            <p className="text-green-700 mb-4">
              Your responses have been submitted successfully.
            </p>
            <p className="text-sm text-muted-foreground">
              We've received your answers and will update your bookkeeping accordingly.
              You can close this page now.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentDisplayItem = displayItems[currentIndex];
  const primaryQueryId = currentDisplayItem?.primaryQueryId;

  if (showCelebration && !isSubmitted) {
    return (
      <div className="h-[100dvh] bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 flex flex-col items-center justify-center p-4 overflow-hidden">
        <div className="text-center max-w-md mx-auto">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 mx-auto mb-6 flex items-center justify-center shadow-lg animate-bounce">
            <PartyPopper className="w-12 h-12 text-white" />
          </div>
          
          <h1 className="text-3xl font-bold text-green-800 mb-3">
            Amazing Work!
          </h1>
          
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            <p className="text-lg text-green-700">
              You've answered all {allDisplayItems.length} {allDisplayItems.length === 1 ? 'query' : 'queries'}!
            </p>
            <Sparkles className="w-5 h-5 text-yellow-500" />
          </div>
          
          <div className="bg-white/80 backdrop-blur rounded-xl p-4 mb-6 border border-green-200 shadow-sm">
            <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
              <Cloud className="w-4 h-4" />
              <span className="text-sm font-medium">All your answers are safely saved</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Your progress is automatically saved to the cloud. You won't lose anything!
            </p>
          </div>
          
          <Button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            size="lg"
            className="w-full h-14 text-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg"
            data-testid="button-submit-celebration"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-6 h-6 mr-2" />
                Submit All Responses
              </>
            )}
          </Button>
          
          <button
            onClick={() => {
              setShowCelebration(false);
              hasDismissedCelebration.current = true;
            }}
            className="mt-4 text-sm text-muted-foreground hover:text-foreground underline"
            data-testid="button-review-answers"
          >
            Wait, let me review my answers first
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col overflow-hidden fixed inset-0 overscroll-none touch-none">
      {/* Welcome back toast */}
      {showWelcomeBack && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 shadow-lg flex items-center gap-2">
            <Cloud className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-700 font-medium">Welcome back! Your progress is saved</span>
          </div>
        </div>
      )}

      {/* Compact header with global save status */}
      <header className="bg-white border-b shrink-0">
        <div className="max-w-4xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between">
            <img src={logoPath} alt="Logo" className="h-7" />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs font-medium">{data.clientName}</p>
                <p className="text-[10px] text-muted-foreground">{data.projectDescription}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className={cn(
        "flex-1 min-h-0 max-w-4xl mx-auto px-3 py-3 w-full flex flex-col",
        viewMode === 'cards' ? "overflow-hidden" : "overflow-y-auto"
      )}>
        {/* View mode toggle - desktop only */}
        <div className="hidden sm:flex justify-end gap-2 mb-3">
          <Button
            variant={viewMode === 'cards' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('cards')}
            data-testid="button-view-cards"
          >
            Cards
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
            data-testid="button-view-list"
          >
            List
          </Button>
        </div>

        {viewMode === 'cards' && currentDisplayItem ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden" {...swipeHandlers}>
            <Card 
              className={cn(
                "flex-1 flex flex-col min-h-0 overflow-hidden transition-colors duration-300",
                CARD_BACKGROUND_COLORS[currentIndex % CARD_BACKGROUND_COLORS.length]
              )}
              style={{ touchAction: 'pan-y' }} 
              data-testid={`query-card-${currentDisplayItem.id}`}
            >
              <CardHeader className="border-b py-2 px-3 bg-white/50 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs transition-all duration-300",
                        isPulsing && "scale-125 bg-primary text-primary-foreground animate-pulse"
                      )}
                    >
                      {currentIndex + 1} of {displayItemCount}
                    </Badge>
                    {currentDisplayItem.type === 'group' && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Folder className="w-3 h-3" />
                        {currentDisplayItem.groupName} ({currentDisplayItem.queries.length})
                      </Badge>
                    )}
                  </div>
                  {responses[primaryQueryId]?.clientResponse?.trim() && (
                    <Badge variant="default" className="bg-green-600 text-xs py-0">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Answered
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 overflow-y-auto pt-3 pb-3 px-3 space-y-3 touch-pan-y overscroll-contain">
                {currentDisplayItem.type === 'group' ? (
                  <>
                    {/* List of transactions in the group - scrollable */}
                    <div className="space-y-2 max-h-44 overflow-y-auto border rounded-lg p-2 bg-slate-50 overscroll-contain touch-pan-y">
                      {currentDisplayItem.queries.map((query, idx) => (
                        <div key={query.id} className="flex items-center gap-3 p-2 bg-white rounded border text-sm">
                          <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <p className="truncate">{query.description || 'Transaction'}</p>
                            <div className="flex gap-3 text-xs text-muted-foreground">
                              {query.date && <span>{formatDate(query.date)}</span>}
                              {formatAmount(query.moneyIn, query.moneyOut) && (
                                <span className={formatAmount(query.moneyIn, query.moneyOut)?.type === 'in' ? 'text-green-600' : 'text-red-600'}>
                                  {formatAmount(query.moneyIn, query.moneyOut)?.amount}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Common query for the group - use group description if available */}
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <p className="text-sm text-blue-700">
                          {currentDisplayItem.groupDescription?.trim() || currentDisplayItem.queries[0]?.ourQuery}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Single query display - same layout as grouped for consistency */}
                    <div className="space-y-2 border rounded-lg p-2 bg-slate-50">
                      <div className="flex items-center gap-3 p-2 bg-white rounded border text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="truncate">{currentDisplayItem.queries[0]?.description || 'Transaction'}</p>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            {currentDisplayItem.queries[0]?.date && (
                              <span>{formatDate(currentDisplayItem.queries[0].date)}</span>
                            )}
                            {formatAmount(currentDisplayItem.queries[0]?.moneyIn ?? null, currentDisplayItem.queries[0]?.moneyOut ?? null) && (
                              <span className={formatAmount(currentDisplayItem.queries[0]?.moneyIn ?? null, currentDisplayItem.queries[0]?.moneyOut ?? null)?.type === 'in' ? 'text-green-600' : 'text-red-600'}>
                                {formatAmount(currentDisplayItem.queries[0]?.moneyIn ?? null, currentDisplayItem.queries[0]?.moneyOut ?? null)?.amount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <p className="text-sm text-blue-700">{currentDisplayItem.queries[0]?.ourQuery}</p>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Your Response
                    </label>
                    <SaveStatusIndicator queryId={primaryQueryId} />
                  </div>
                  <Textarea
                    value={responses[primaryQueryId]?.clientResponse || ''}
                    onChange={(e) => updateResponse(primaryQueryId, 'clientResponse', e.target.value)}
                    placeholder="Type your answer here..."
                    className="min-h-[80px] resize-none text-sm"
                    data-testid={`textarea-response-${primaryQueryId}`}
                  />
                </div>

                {/* VAT toggle and Upload button in 50/50 row */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                    <label className="text-sm font-medium">Includes VAT?</label>
                    <Switch
                      checked={responses[primaryQueryId]?.hasVat || false}
                      onCheckedChange={(checked) => updateResponse(primaryQueryId, 'hasVat', checked)}
                      data-testid={`switch-vat-${primaryQueryId}`}
                    />
                  </div>
                  
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload(primaryQueryId, file);
                          e.target.value = '';
                        }
                      }}
                      disabled={uploadingFiles[primaryQueryId]}
                      data-testid={`input-file-${primaryQueryId}`}
                    />
                    <div className={cn(
                      "flex items-center justify-center gap-1.5 py-2 px-2 border-2 border-dashed rounded-lg transition-colors text-xs h-full",
                      uploadingFiles[primaryQueryId] 
                        ? "bg-slate-100 border-slate-300 cursor-wait"
                        : "border-slate-300 hover:border-primary hover:bg-slate-50"
                    )}>
                      {uploadingFiles[primaryQueryId] ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span className="text-muted-foreground">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Paperclip className="w-3 h-3 text-muted-foreground" />
                          <span className="text-muted-foreground text-[10px]">Attach (optional)</span>
                        </>
                      )}
                    </div>
                  </label>
                </div>
                
                {/* Attachments - single file inline, multiple files in scrollable card */}
                {(responses[primaryQueryId]?.attachments?.length ?? 0) === 1 && (
                  <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border text-sm">
                    {getFileIcon(responses[primaryQueryId]?.attachments?.[0]?.fileType || '')}
                    <span className="flex-1 truncate text-xs">{responses[primaryQueryId]?.attachments?.[0]?.fileName}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500 hover:text-red-600"
                      onClick={() => removeAttachment(primaryQueryId, responses[primaryQueryId]?.attachments?.[0]?.objectPath || '')}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                
                {(responses[primaryQueryId]?.attachments?.length ?? 0) >= 2 && (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto border rounded-lg p-2 bg-slate-50 overscroll-contain touch-pan-y">
                    {responses[primaryQueryId]?.attachments?.map((attachment) => (
                      <div 
                        key={attachment.objectPath}
                        className="flex items-center gap-2 p-1.5 bg-white rounded border text-xs"
                      >
                        {getFileIcon(attachment.fileType)}
                        <span className="flex-1 truncate">{attachment.fileName}</span>
                        <span className="text-muted-foreground shrink-0">{formatFileSize(attachment.fileSize)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-red-500 hover:text-red-600"
                          onClick={() => removeAttachment(primaryQueryId, attachment.objectPath)}
                          data-testid={`button-remove-attachment-${attachment.objectPath}`}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          /* List view - now shows display items (groups as single items) */
          <div className="space-y-4">
            {displayItems.map((item, index) => (
              <DisplayItemCard
                key={item.id}
                item={item}
                index={index}
                responses={responses}
                onUpdateResponse={updateResponse}
                onFileUpload={handleFileUpload}
                onRemoveAttachment={removeAttachment}
                uploadingFiles={uploadingFiles}
                saveStatus={saveStatus}
                formatDate={formatDate}
                formatAmount={formatAmount}
                formatFileSize={formatFileSize}
                getFileIcon={getFileIcon}
              />
            ))}
            
            <div className="sticky bottom-4 pt-4">
              <Button
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg"
                data-testid="button-submit-all"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Submit All Responses ({answeredDisplayItemCount}/{displayItemCount})
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Footer navigation - simplified for mobile */}
      {viewMode === 'cards' && (
        <footer className="shrink-0 bg-white border-t safe-area-pb">
          {/* Filter toggle row */}
          <div className="flex justify-center gap-2 py-2 px-4 border-b bg-slate-50">
            <Button
              variant={filterMode === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setFilterMode('all');
                // Reset to first item will happen via useEffect on filterMode change
              }}
              className="h-8 text-xs"
              data-testid="button-filter-all"
            >
              Show All ({allDisplayItems.length})
            </Button>
            <Button
              variant={filterMode === 'unanswered' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setFilterMode('unanswered');
                // Reset to first item will happen via useEffect on filterMode change
              }}
              className="h-8 text-xs"
              data-testid="button-filter-unanswered"
            >
              Unanswered ({unansweredCount})
            </Button>
          </div>
          
          {/* Navigation row */}
          {currentDisplayItem ? (
            <div className="max-w-4xl mx-auto py-3 px-4">
              <div className="flex items-center justify-between gap-4">
                <Button
                  variant="outline"
                  onClick={navigatePrev}
                  disabled={currentIndex === 0}
                  className="h-12 px-6 text-base"
                  data-testid="button-previous"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back
                </Button>
                
                {/* Simple count display */}
                <div className="flex flex-col items-center">
                  <span 
                    className={cn(
                      "text-lg font-semibold transition-all duration-300",
                      isPulsing && "scale-125 text-primary"
                    )}
                  >
                    {currentIndex + 1} / {displayItemCount}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {answeredDisplayItemCount} answered
                  </span>
                </div>
                
                {currentIndex < displayItemCount - 1 ? (
                  <Button
                    onClick={navigateNext}
                    className="h-12 px-6 text-base"
                    data-testid="button-next"
                  >
                    Next
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={submitMutation.isPending}
                    className="h-12 px-6 text-base bg-green-600 hover:bg-green-700"
                    data-testid="button-submit"
                  >
                    {submitMutation.isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5 mr-2" />
                        Submit
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto py-4 px-4 text-center">
              <p className="text-muted-foreground mb-3">
                {filterMode === 'unanswered' ? 'All queries answered!' : 'No queries to display'}
              </p>
              {filterMode === 'unanswered' && (
                <Button
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-submit-all-done"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Submit All Responses
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </footer>
      )}

      {/* Contact footer - list view only */}
      {viewMode === 'list' && (
        <footer className="border-t bg-white mt-8 py-4">
          <div className="max-w-4xl mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>If you have any questions, please contact your accountant.</p>
          </div>
        </footer>
      )}
    </div>
  );
}

interface QueryListItemProps {
  query: Query;
  index: number;
  response: QueryResponse;
  onUpdateResponse: (queryId: string, field: 'clientResponse' | 'hasVat', value: string | boolean | null) => void;
  onFileUpload: (queryId: string, file: File) => void;
  onRemoveAttachment: (queryId: string, objectPath: string) => void;
  isUploading: boolean;
  saveStatus?: SaveStatus;
  formatDate: (date: string | null) => string | null;
  formatAmount: (moneyIn: string | null, moneyOut: string | null) => { amount: string; type: 'in' | 'out' } | null;
  formatFileSize: (bytes: number) => string;
  getFileIcon: (fileType: string) => JSX.Element;
}

function QueryListItem({ 
  query, 
  index, 
  response, 
  onUpdateResponse, 
  onFileUpload,
  onRemoveAttachment,
  isUploading,
  saveStatus,
  formatDate, 
  formatAmount,
  formatFileSize,
  getFileIcon,
}: QueryListItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const isAnswered = response?.clientResponse?.trim();
  const amountInfo = formatAmount(query.moneyIn, query.moneyOut);

  return (
    <Card 
      className={cn(
        "overflow-hidden transition-all",
        isAnswered && "border-green-200 bg-green-50/30"
      )}
      data-testid={`query-list-item-${query.id}`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-medium",
            isAnswered ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
          )}>
            {isAnswered ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-medium truncate">{query.description || 'Transaction Query'}</p>
              {query.group && (
                <Badge variant="secondary" className="text-xs gap-1 shrink-0">
                  <Folder className="w-3 h-3" />
                  {query.group.groupName}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {query.date && <span>{formatDate(query.date)}</span>}
              {amountInfo && (
                <span className={amountInfo.type === 'in' ? 'text-green-600' : 'text-red-600'}>
                  {amountInfo.amount}
                </span>
              )}
              {(response?.attachments?.length ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <Paperclip className="w-3 h-3" />
                  {response?.attachments?.length}
                </span>
              )}
            </div>
          </div>
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mt-4">
            <div className="flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700">{query.ourQuery}</p>
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium">Your Response</label>
              {saveStatus && (
                <div className="flex items-center gap-1.5 text-xs">
                  {saveStatus === 'saving' && (
                    <span className="flex items-center gap-1 text-muted-foreground animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Saving...
                    </span>
                  )}
                  {saveStatus === 'saved' && (
                    <span className="flex items-center gap-1 text-green-600">
                      <Cloud className="w-3 h-3" />
                      Saved
                    </span>
                  )}
                  {saveStatus === 'unsaved' && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <CloudOff className="w-3 h-3" />
                      Unsaved
                    </span>
                  )}
                  {saveStatus === 'error' && (
                    <span className="flex items-center gap-1 text-red-600">
                      <AlertCircle className="w-3 h-3" />
                      Save failed
                    </span>
                  )}
                </div>
              )}
            </div>
            <Textarea
              value={response?.clientResponse || ''}
              onChange={(e) => onUpdateResponse(query.id, 'clientResponse', e.target.value)}
              placeholder="Type your answer here..."
              className="min-h-[80px] resize-none"
              data-testid={`textarea-list-response-${query.id}`}
            />
          </div>
          
          <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
            <label className="text-sm">Includes VAT?</label>
            <Switch
              checked={response?.hasVat || false}
              onCheckedChange={(checked) => onUpdateResponse(query.id, 'hasVat', checked)}
              data-testid={`switch-list-vat-${query.id}`}
            />
          </div>

          <div className="border-t pt-3">
            <label className="text-sm font-medium flex items-center gap-2 mb-2">
              <Paperclip className="w-3 h-3" />
              Attachments
            </label>
            
            {(response?.attachments?.length ?? 0) > 0 && (
              <div className="space-y-1 mb-2">
                {response?.attachments?.map((attachment) => (
                  <div 
                    key={attachment.objectPath}
                    className="flex items-center gap-2 p-2 bg-slate-50 rounded border text-sm"
                  >
                    {getFileIcon(attachment.fileType)}
                    <span className="flex-1 truncate">{attachment.fileName}</span>
                    <span className="text-xs text-muted-foreground">{formatFileSize(attachment.fileSize)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500 hover:text-red-600"
                      onClick={() => onRemoveAttachment(query.id, attachment.objectPath)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <label className="cursor-pointer block">
              <input
                type="file"
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onFileUpload(query.id, file);
                    e.target.value = '';
                  }
                }}
                disabled={isUploading}
              />
              <div className={cn(
                "flex items-center justify-center gap-2 p-2 border border-dashed rounded text-sm transition-colors",
                isUploading 
                  ? "bg-slate-100 border-slate-300 cursor-wait"
                  : "border-slate-300 hover:border-primary hover:bg-slate-50"
              )}>
                {isUploading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-muted-foreground">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Upload file</span>
                  </>
                )}
              </div>
            </label>
          </div>
        </div>
      )}
    </Card>
  );
}

interface DisplayItemCardProps {
  item: DisplayItem;
  index: number;
  responses: Record<string, QueryResponse>;
  onUpdateResponse: (queryId: string, field: 'clientResponse' | 'hasVat', value: string | boolean | null) => void;
  onFileUpload: (queryId: string, file: File) => void;
  onRemoveAttachment: (queryId: string, objectPath: string) => void;
  uploadingFiles: Record<string, boolean>;
  saveStatus: Record<string, SaveStatus>;
  formatDate: (date: string | null) => string | null;
  formatAmount: (moneyIn: string | null, moneyOut: string | null) => { amount: string; type: 'in' | 'out' } | null;
  formatFileSize: (bytes: number) => string;
  getFileIcon: (fileType: string) => JSX.Element;
}

function DisplayItemCard({
  item,
  index,
  responses,
  onUpdateResponse,
  onFileUpload,
  onRemoveAttachment,
  uploadingFiles,
  saveStatus,
  formatDate,
  formatAmount,
  formatFileSize,
  getFileIcon,
}: DisplayItemCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const primaryQueryId = item.primaryQueryId;
  const response = responses[primaryQueryId];
  const isAnswered = response?.clientResponse?.trim();
  const isGroup = item.type === 'group';

  return (
    <Card 
      className={cn(
        "overflow-hidden transition-all",
        isAnswered && "border-green-200 bg-green-50/30"
      )}
      data-testid={`display-item-${item.id}`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-medium",
            isAnswered ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
          )}>
            {isAnswered ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {isGroup ? (
                <>
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Folder className="w-3 h-3" />
                    {item.groupName}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    ({item.queries.length} transactions)
                  </span>
                </>
              ) : (
                <p className="font-medium truncate">{item.queries[0]?.description || 'Transaction Query'}</p>
              )}
            </div>
            {!isGroup && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {item.queries[0]?.date && <span>{formatDate(item.queries[0].date)}</span>}
                {formatAmount(item.queries[0]?.moneyIn ?? null, item.queries[0]?.moneyOut ?? null) && (
                  <span className={formatAmount(item.queries[0]?.moneyIn ?? null, item.queries[0]?.moneyOut ?? null)?.type === 'in' ? 'text-green-600' : 'text-red-600'}>
                    {formatAmount(item.queries[0]?.moneyIn ?? null, item.queries[0]?.moneyOut ?? null)?.amount}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t">
          {isGroup && (
            <>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2 bg-slate-50 mt-4">
                {item.queries.map((query, idx) => (
                  <div key={query.id} className="flex items-center gap-3 p-2 bg-white rounded border text-sm">
                    <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate">{query.description || 'Transaction'}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        {query.date && <span>{formatDate(query.date)}</span>}
                        {formatAmount(query.moneyIn, query.moneyOut) && (
                          <span className={formatAmount(query.moneyIn, query.moneyOut)?.type === 'in' ? 'text-green-600' : 'text-red-600'}>
                            {formatAmount(query.moneyIn, query.moneyOut)?.amount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mt-4">
            <div className="flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700">{item.queries[0]?.ourQuery}</p>
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium">Your Response</label>
              {saveStatus[primaryQueryId] && (
                <div className="flex items-center gap-1.5 text-xs">
                  {saveStatus[primaryQueryId] === 'saving' && (
                    <span className="flex items-center gap-1 text-muted-foreground animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Saving...
                    </span>
                  )}
                  {saveStatus[primaryQueryId] === 'saved' && (
                    <span className="flex items-center gap-1 text-green-600">
                      <Cloud className="w-3 h-3" />
                      Saved
                    </span>
                  )}
                  {saveStatus[primaryQueryId] === 'unsaved' && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <CloudOff className="w-3 h-3" />
                      Unsaved
                    </span>
                  )}
                  {saveStatus[primaryQueryId] === 'error' && (
                    <span className="flex items-center gap-1 text-red-600">
                      <AlertCircle className="w-3 h-3" />
                      Save failed
                    </span>
                  )}
                </div>
              )}
            </div>
            <Textarea
              value={response?.clientResponse || ''}
              onChange={(e) => onUpdateResponse(primaryQueryId, 'clientResponse', e.target.value)}
              placeholder="Type your answer here..."
              className="min-h-[80px] text-sm"
              data-testid={`textarea-list-response-${primaryQueryId}`}
            />
          </div>
          
          {/* VAT toggle and Upload button in 50/50 row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
              <label className="text-sm font-medium">Includes VAT?</label>
              <Switch
                checked={response?.hasVat || false}
                onCheckedChange={(checked) => onUpdateResponse(primaryQueryId, 'hasVat', checked)}
                data-testid={`switch-list-vat-${primaryQueryId}`}
              />
            </div>
            
            <label className="cursor-pointer">
              <input
                type="file"
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onFileUpload(primaryQueryId, file);
                    e.target.value = '';
                  }
                }}
                disabled={uploadingFiles[primaryQueryId]}
                data-testid={`input-list-file-${primaryQueryId}`}
              />
              <div className={cn(
                "flex items-center justify-center gap-1.5 py-2 px-2 border-2 border-dashed rounded-lg transition-colors text-xs h-full",
                uploadingFiles[primaryQueryId] 
                  ? "bg-slate-100 border-slate-300 cursor-wait"
                  : "border-slate-300 hover:border-primary hover:bg-slate-50"
              )}>
                {uploadingFiles[primaryQueryId] ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-muted-foreground">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Paperclip className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground text-[10px]">Attach (optional)</span>
                  </>
                )}
              </div>
            </label>
          </div>
          
          {/* Attachments - single file inline, multiple files in scrollable card */}
          {(response?.attachments?.length ?? 0) === 1 && (
            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border text-sm">
              {getFileIcon(response?.attachments?.[0]?.fileType || '')}
              <span className="flex-1 truncate text-xs">{response?.attachments?.[0]?.fileName}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-500 hover:text-red-600"
                onClick={() => onRemoveAttachment(primaryQueryId, response?.attachments?.[0]?.objectPath || '')}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}
          
          {(response?.attachments?.length ?? 0) >= 2 && (
            <div className="space-y-1.5 max-h-44 overflow-y-auto border rounded-lg p-2 bg-slate-50 overscroll-contain touch-pan-y">
              {response?.attachments?.map((attachment) => (
                <div 
                  key={attachment.objectPath}
                  className="flex items-center gap-2 p-1.5 bg-white rounded border text-xs"
                >
                  {getFileIcon(attachment.fileType)}
                  <span className="flex-1 truncate">{attachment.fileName}</span>
                  <span className="text-muted-foreground shrink-0">{formatFileSize(attachment.fileSize)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-red-500 hover:text-red-600"
                    onClick={() => onRemoveAttachment(primaryQueryId, attachment.objectPath)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
