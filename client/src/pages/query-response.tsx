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
} from "lucide-react";

interface QueryAttachment {
  objectPath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
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
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive",
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

  useEffect(() => {
    if (data?.queries) {
      const initialResponses: Record<string, QueryResponse> = {};
      const initialSaveStatus: Record<string, SaveStatus> = {};
      data.queries.forEach(q => {
        initialResponses[q.id] = {
          queryId: q.id,
          clientResponse: q.clientResponse || '',
          hasVat: q.hasVat,
          attachments: q.clientAttachments || [],
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
    const responseArray = Object.values(responses);
    submitMutation.mutate(responseArray);
  };

  const answeredCount = Object.values(responses).filter(r => r.clientResponse?.trim()).length;
  const totalCount = data?.queries?.length || 0;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <img src={logoPath} alt="Logo" className="h-10" />
            <div className="text-right">
              <p className="text-sm font-medium">{data.clientName}</p>
              <p className="text-xs text-muted-foreground">{data.projectDescription}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-semibold">
              {data.recipientName ? `Hello ${data.recipientName}` : 'Hello'}
            </h1>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'cards' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('cards')}
                className="hidden sm:inline-flex"
                data-testid="button-view-cards"
              >
                Cards
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="hidden sm:inline-flex"
                data-testid="button-view-list"
              >
                List
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground text-sm mb-4">
            Please help us by answering the following {totalCount} {totalCount === 1 ? 'query' : 'queries'} about your transactions.
          </p>
          
          <div className="flex items-center gap-3 bg-white rounded-lg p-3 border">
            <div className="flex-1">
              <Progress value={progress} className="h-2" />
            </div>
            <div className="text-sm font-medium whitespace-nowrap">
              {answeredCount} / {totalCount} answered
            </div>
          </div>
        </div>

        {viewMode === 'cards' ? (
          <div className="space-y-4" {...swipeHandlers}>
            <div className="sm:hidden flex items-center justify-center gap-2 text-xs text-muted-foreground mb-2">
              <Hand className="w-3 h-3" />
              <span>Swipe left or right to navigate</span>
            </div>
            <Card className="overflow-hidden touch-pan-y" data-testid={`query-card-${currentQuery.id}`}>
              <CardHeader className="bg-slate-50 border-b pb-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-sm">
                    Query {currentIndex + 1} of {totalCount}
                  </Badge>
                  {responses[currentQuery.id]?.clientResponse?.trim() && (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Answered
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
                  {currentQuery.date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Date</p>
                        <p className="text-sm font-medium">{formatDate(currentQuery.date)}</p>
                      </div>
                    </div>
                  )}
                  {currentQuery.description && (
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Description</p>
                        <p className="text-sm font-medium truncate">{currentQuery.description}</p>
                      </div>
                    </div>
                  )}
                  {formatAmount(currentQuery.moneyIn, currentQuery.moneyOut) && (
                    <div className="flex items-center gap-2">
                      <PoundSterling className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className={cn(
                          "text-sm font-medium",
                          formatAmount(currentQuery.moneyIn, currentQuery.moneyOut)?.type === 'in' 
                            ? "text-green-600" 
                            : "text-red-600"
                        )}>
                          {formatAmount(currentQuery.moneyIn, currentQuery.moneyOut)?.amount}
                          <span className="text-xs text-muted-foreground ml-1">
                            ({formatAmount(currentQuery.moneyIn, currentQuery.moneyOut)?.type})
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <HelpCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-800 mb-1">Our Question</p>
                      <p className="text-blue-700">{currentQuery.ourQuery}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Your Response
                    </label>
                    <SaveStatusIndicator queryId={currentQuery.id} />
                  </div>
                  <Textarea
                    value={responses[currentQuery.id]?.clientResponse || ''}
                    onChange={(e) => updateResponse(currentQuery.id, 'clientResponse', e.target.value)}
                    placeholder="Type your answer here..."
                    className="min-h-[120px] resize-none"
                    data-testid={`textarea-response-${currentQuery.id}`}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <label className="text-sm font-medium">Does this include VAT?</label>
                    <p className="text-xs text-muted-foreground">Toggle if this transaction includes VAT</p>
                  </div>
                  <Switch
                    checked={responses[currentQuery.id]?.hasVat || false}
                    onCheckedChange={(checked) => updateResponse(currentQuery.id, 'hasVat', checked)}
                    data-testid={`switch-vat-${currentQuery.id}`}
                  />
                </div>

                <div className="border-t pt-4">
                  <label className="text-sm font-medium flex items-center gap-2 mb-3">
                    <Paperclip className="w-4 h-4" />
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
                      "flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-lg transition-colors",
                      uploadingFiles[currentQuery.id] 
                        ? "bg-slate-100 border-slate-300 cursor-wait"
                        : "border-slate-300 hover:border-primary hover:bg-slate-50"
                    )}>
                      {uploadingFiles[currentQuery.id] ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Click to upload a file
                          </span>
                        </>
                      )}
                    </div>
                  </label>
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    Max 10MB. Images, PDFs, and Office documents accepted.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                data-testid="button-previous"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
              
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
              
              {currentIndex < totalCount - 1 ? (
                <Button
                  onClick={() => setCurrentIndex(prev => Math.min(totalCount - 1, prev + 1))}
                  data-testid="button-next"
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-submit"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Submit All
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        ) : (
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

      <footer className="border-t bg-white mt-8 py-4">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>If you have any questions, please contact your accountant.</p>
        </div>
      </footer>
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
            <p className="font-medium truncate">{query.description || 'Transaction Query'}</p>
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
