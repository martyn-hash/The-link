import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { useSwipeable } from "react-swipeable";
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

export default function QueryResponsePage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [responses, setResponses] = useState<Record<string, QueryResponse>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
  const saveTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const DEBOUNCE_MS = 1500; // Auto-save after 1.5 seconds of no typing

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
      data.queries.forEach(q => {
        initialResponses[q.id] = {
          queryId: q.id,
          clientResponse: q.clientResponse || '',
          hasVat: q.hasVat,
          attachments: sanitizeAttachments(q.clientAttachments),
        };
        // If there's already a response saved, mark it as saved
        if (q.clientResponse || q.clientAttachments?.length) {
          initialSaveStatus[q.id] = 'saved';
        }
      });
      setResponses(initialResponses);
      setSaveStatus(initialSaveStatus);
    }
  }, [data]);

  // Swipe handlers - must be called before any early returns to satisfy React hooks rules
  const totalCount = data?.queries?.length || 0;
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (currentIndex < totalCount - 1) {
        setCurrentIndex(prev => prev + 1);
      }
    },
    onSwipedRight: () => {
      if (currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
    },
    preventScrollOnSwipe: true,
    trackMouse: false,
    trackTouch: true,
    delta: 50,
  });

  const updateResponse = (queryId: string, field: 'clientResponse' | 'hasVat', value: string | boolean | null) => {
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

      toast({
        title: "File uploaded",
        description: fileName,
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
    // Check for unanswered queries and provide specific, friendly feedback
    const unansweredQueries: { index: number; description: string }[] = [];
    data?.queries.forEach((query, index) => {
      const response = responses[query.id];
      const hasResponse = response?.clientResponse?.trim();
      const hasAttachments = (response?.attachments?.length ?? 0) > 0;
      if (!hasResponse && !hasAttachments) {
        unansweredQueries.push({
          index: index + 1,
          description: query.description || query.ourQuery?.slice(0, 30) || 'Transaction'
        });
      }
    });

    if (unansweredQueries.length > 0) {
      if (unansweredQueries.length === 1) {
        const q = unansweredQueries[0];
        toast({
          title: "Almost there! One more answer needed",
          description: `Please answer Query ${q.index} (${q.description}) before submitting.`,
        });
        // Navigate to the unanswered query
        setCurrentIndex(q.index - 1);
      } else if (unansweredQueries.length <= 3) {
        const queryNumbers = unansweredQueries.map(q => q.index).join(', ');
        toast({
          title: `${unansweredQueries.length} more answers needed`,
          description: `Please answer Queries ${queryNumbers} before submitting.`,
        });
        // Navigate to the first unanswered query
        setCurrentIndex(unansweredQueries[0].index - 1);
      } else {
        toast({
          title: `${unansweredQueries.length} more answers needed`,
          description: `Please answer all queries before submitting. Let's start with Query ${unansweredQueries[0].index}.`,
        });
        setCurrentIndex(unansweredQueries[0].index - 1);
      }
      return;
    }

    const responseArray = Object.values(responses);
    submitMutation.mutate(responseArray);
  };

  const answeredCount = Object.values(responses).filter(r => r.clientResponse?.trim()).length;
  const progress = totalCount > 0 ? (answeredCount / totalCount) * 100 : 0;

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
    const errorData = error as any;
    const isExpired = errorData?.expired;
    const isCompleted = errorData?.completed;

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
              {isCompleted ? "Already Submitted" : isExpired ? "Link Expired" : "Invalid Link"}
            </h2>
            <p className="text-muted-foreground mb-4">
              {isCompleted 
                ? "Thank you! Your responses have already been submitted."
                : isExpired 
                  ? "This link has expired. Please contact us if you still need to respond to these queries."
                  : "This link is not valid. Please check the link or contact us for assistance."
              }
            </p>
            <p className="text-sm text-muted-foreground">
              If you need help, please contact your accountant.
            </p>
          </CardContent>
        </Card>
      </div>
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

  const currentQuery = data.queries[currentIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Compact header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between">
            <img src={logoPath} alt="Logo" className="h-7" />
            <div className="text-right">
              <p className="text-xs font-medium">{data.clientName}</p>
              <p className="text-[10px] text-muted-foreground">{data.projectDescription}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-3 py-3 w-full">
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

        {viewMode === 'cards' ? (
          <div className="space-y-3" {...swipeHandlers}>
            <Card className="overflow-hidden touch-pan-y" data-testid={`query-card-${currentQuery.id}`}>
              <CardHeader className="bg-slate-50 border-b py-2 px-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Query {currentIndex + 1} of {totalCount}
                    </Badge>
                    {currentQuery.group && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Folder className="w-3 h-3" />
                        {currentQuery.group.groupName}
                      </Badge>
                    )}
                  </div>
                  {responses[currentQuery.id]?.clientResponse?.trim() && (
                    <Badge variant="default" className="bg-green-600 text-xs py-0">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Answered
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-3 pb-3 px-3 space-y-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  {currentQuery.date && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-medium">{formatDate(currentQuery.date)}</span>
                    </div>
                  )}
                  {formatAmount(currentQuery.moneyIn, currentQuery.moneyOut) && (
                    <div className="flex items-center gap-1.5">
                      <PoundSterling className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className={cn(
                        "font-medium",
                        formatAmount(currentQuery.moneyIn, currentQuery.moneyOut)?.type === 'in' 
                          ? "text-green-600" 
                          : "text-red-600"
                      )}>
                        {formatAmount(currentQuery.moneyIn, currentQuery.moneyOut)?.amount}
                        <span className="text-xs text-muted-foreground ml-1">
                          ({formatAmount(currentQuery.moneyIn, currentQuery.moneyOut)?.type})
                        </span>
                      </span>
                    </div>
                  )}
                  {currentQuery.description && (
                    <div className="flex items-center gap-1.5 w-full">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground truncate">{currentQuery.description}</span>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-700">{currentQuery.ourQuery}</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Your Response
                    </label>
                    <SaveStatusIndicator queryId={currentQuery.id} />
                  </div>
                  <Textarea
                    value={responses[currentQuery.id]?.clientResponse || ''}
                    onChange={(e) => updateResponse(currentQuery.id, 'clientResponse', e.target.value)}
                    placeholder="Type your answer here..."
                    className="min-h-[80px] resize-none text-sm"
                    data-testid={`textarea-response-${currentQuery.id}`}
                  />
                </div>

                <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                  <label className="text-sm font-medium">Includes VAT?</label>
                  <Switch
                    checked={responses[currentQuery.id]?.hasVat || false}
                    onCheckedChange={(checked) => updateResponse(currentQuery.id, 'hasVat', checked)}
                    data-testid={`switch-vat-${currentQuery.id}`}
                  />
                </div>

                <div className="border-t pt-3">
                  <label className="text-sm font-medium flex items-center gap-1.5 mb-2">
                    <Paperclip className="w-3.5 h-3.5" />
                    Attachments
                    <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                  </label>
                  
                  {(responses[currentQuery.id]?.attachments?.length ?? 0) > 0 && (
                    <div className="space-y-2 mb-3">
                      {responses[currentQuery.id]?.attachments?.map((attachment) => (
                        <div 
                          key={attachment.objectPath}
                          className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border"
                        >
                          {getFileIcon(attachment.fileType)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(attachment.fileSize)}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => removeAttachment(currentQuery.id, attachment.objectPath)}
                            data-testid={`button-remove-attachment-${attachment.objectPath}`}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload(currentQuery.id, file);
                          e.target.value = '';
                        }
                      }}
                      disabled={uploadingFiles[currentQuery.id]}
                      data-testid={`input-file-${currentQuery.id}`}
                    />
                    <div className={cn(
                      "flex items-center justify-center gap-2 py-2 px-3 border-2 border-dashed rounded-lg transition-colors text-sm",
                      uploadingFiles[currentQuery.id] 
                        ? "bg-slate-100 border-slate-300 cursor-wait"
                        : "border-slate-300 hover:border-primary hover:bg-slate-50"
                    )}>
                      {uploadingFiles[currentQuery.id] ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span className="text-muted-foreground">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Click to upload a file
                          </span>
                        </>
                      )}
                    </div>
                  </label>
                  <p className="text-[10px] text-muted-foreground mt-1 text-center">
                    Max 10MB. Images, PDFs, and Office documents accepted.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* List view */
          <div className="space-y-4">
            {data.queries.map((query, index) => (
              <QueryListItem
                key={query.id}
                query={query}
                index={index}
                response={responses[query.id]}
                onUpdateResponse={updateResponse}
                onFileUpload={handleFileUpload}
                onRemoveAttachment={removeAttachment}
                isUploading={uploadingFiles[query.id] || false}
                saveStatus={saveStatus[query.id]}
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
                    Submit All Responses ({answeredCount}/{totalCount})
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Sticky footer navigation with compact progress - cards view only */}
      {viewMode === 'cards' && (
        <footer className="sticky bottom-0 bg-white border-t py-2 px-3 safe-area-pb">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="h-9"
                data-testid="button-previous"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              
              {/* Compact progress dots with count */}
              <div className="flex items-center gap-1.5">
                <div className="flex gap-1">
                  {data.queries.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      className={cn(
                        "w-2 h-2 rounded-full transition-colors",
                        idx === currentIndex 
                          ? "bg-primary" 
                          : responses[data.queries[idx].id]?.clientResponse?.trim()
                            ? "bg-green-500"
                            : "bg-slate-300"
                      )}
                      data-testid={`dot-${idx}`}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {answeredCount}/{totalCount}
                </span>
              </div>
              
              {currentIndex < totalCount - 1 ? (
                <Button
                  size="sm"
                  onClick={() => setCurrentIndex(prev => Math.min(totalCount - 1, prev + 1))}
                  className="h-9"
                  data-testid="button-next"
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending}
                  className="h-9 bg-green-600 hover:bg-green-700"
                  data-testid="button-submit"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-1" />
                      Submit All
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
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
