import { useState, useEffect } from "react";
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
} from "lucide-react";

interface Query {
  id: string;
  date: string | null;
  description: string | null;
  moneyIn: string | null;
  moneyOut: string | null;
  hasVat: boolean | null;
  ourQuery: string;
  clientResponse: string | null;
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
}

export default function QueryResponsePage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [responses, setResponses] = useState<Record<string, QueryResponse>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [isSubmitted, setIsSubmitted] = useState(false);

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

  useEffect(() => {
    if (data?.queries) {
      const initialResponses: Record<string, QueryResponse> = {};
      data.queries.forEach(q => {
        initialResponses[q.id] = {
          queryId: q.id,
          clientResponse: q.clientResponse || '',
          hasVat: q.hasVat,
        };
      });
      setResponses(initialResponses);
    }
  }, [data]);

  const updateResponse = (queryId: string, field: 'clientResponse' | 'hasVat', value: string | boolean | null) => {
    setResponses(prev => ({
      ...prev,
      [queryId]: {
        ...prev[queryId],
        [field]: value,
      },
    }));
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
                  <label className="text-sm font-medium flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4" />
                    Your Response
                  </label>
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
                formatDate={formatDate}
                formatAmount={formatAmount}
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
  formatDate: (date: string | null) => string | null;
  formatAmount: (moneyIn: string | null, moneyOut: string | null) => { amount: string; type: 'in' | 'out' } | null;
}

function QueryListItem({ query, index, response, onUpdateResponse, formatDate, formatAmount }: QueryListItemProps) {
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
            <label className="text-sm font-medium mb-1 block">Your Response</label>
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
        </div>
      )}
    </Card>
  );
}
