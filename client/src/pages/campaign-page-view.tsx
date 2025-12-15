import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, AlertCircle, Info, AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface RenderedPage {
  id: string;
  name: string;
  slug: string;
  headerTitle: string | null;
  headerSubtitle: string | null;
  headerImagePath: string | null;
  themeColor: string | null;
  backgroundColor: string | null;
  layoutType: string | null;
  components: RenderedComponent[];
  actions: RenderedAction[];
  visitToken: string;
  isOtpVerified: boolean;
}

interface RenderedComponent {
  id: string;
  componentType: string;
  sectionIndex: number;
  rowIndex: number;
  columnIndex: number;
  columnSpan: number;
  sortOrder: number;
  content: any;
}

interface RenderedAction {
  id: string;
  actionType: string;
  label: string;
  description: string | null;
  requiresOtp: boolean;
  isEnabled: boolean;
  sortOrder: number;
}

export default function CampaignPageView() {
  const [, params] = useRoute('/p/:slug');
  const slug = params?.slug;
  
  const [page, setPage] = useState<RenderedPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const visitToken = new URLSearchParams(window.location.search).get('t');

  useEffect(() => {
    if (slug && visitToken) {
      fetchPage();
    } else if (slug && !visitToken) {
      setError('Invalid page link');
      setLoading(false);
    }
  }, [slug, visitToken]);

  const fetchPage = async () => {
    try {
      const res = await fetch(`/api/public/p/${slug}?t=${visitToken}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load page');
      }
      const data = await res.json();
      setPage(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (actionId: string) => {
    const action = page?.actions.find(a => a.id === actionId);
    if (!action) return;

    if (action.requiresOtp && !page?.isOtpVerified) {
      setPendingActionId(actionId);
      setShowOtpModal(true);
      return;
    }

    executeAction(actionId);
  };

  const executeAction = async (actionId: string, actionData?: any) => {
    setActionLoading(actionId);
    try {
      const res = await fetch(`/api/public/p/${slug}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId,
          visitToken,
          actionData,
        }),
      });

      const result = await res.json();

      if (result.requiresOtp) {
        setPendingActionId(actionId);
        setShowOtpModal(true);
        return;
      }

      if (result.success) {
        setSuccessMessage(result.message || 'Action completed successfully');
        if (result.data?.redirectUrl) {
          window.location.href = result.data.redirectUrl;
        }
      } else {
        toast({ title: 'Error', description: result.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const sendOtp = async () => {
    try {
      const res = await fetch(`/api/public/p/${slug}/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitToken }),
      });
      const result = await res.json();
      if (result.sent) {
        setOtpSent(true);
        toast({ title: 'Verification code sent', description: 'Check your email' });
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const verifyOtp = async () => {
    try {
      const res = await fetch(`/api/public/p/${slug}/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitToken, code: otpCode }),
      });
      const result = await res.json();
      if (result.valid) {
        setShowOtpModal(false);
        setOtpCode('');
        setPage(prev => prev ? { ...prev, isOtpVerified: true } : null);
        if (pendingActionId) {
          executeAction(pendingActionId);
        }
      } else {
        toast({ title: 'Invalid code', description: result.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to load page</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (successMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Thank You</h2>
            <p className="text-muted-foreground">{successMessage}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!page) return null;

  const themeColor = page.themeColor || '#3b82f6';

  return (
    <div className="min-h-screen" style={{ backgroundColor: page.backgroundColor || '#f9fafb' }}>
      {page.headerImagePath && (
        <div className="h-48 bg-cover bg-center" style={{ backgroundImage: `url(${page.headerImagePath})` }} />
      )}
      
      <header className="py-8 px-4" style={{ backgroundColor: themeColor }}>
        <div className="max-w-3xl mx-auto text-white">
          {page.headerTitle && (
            <h1 className="text-3xl font-bold mb-2" data-testid="text-header-title">{page.headerTitle}</h1>
          )}
          {page.headerSubtitle && (
            <p className="text-lg opacity-90" data-testid="text-header-subtitle">{page.headerSubtitle}</p>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto py-8 px-4 space-y-6">
        {page.components.map(component => (
          <ComponentRenderer key={component.id} component={component} themeColor={themeColor} />
        ))}

        {page.actions.length > 0 && (
          <div className="flex flex-wrap gap-3 justify-center pt-6">
            {page.actions.map(action => (
              <Button
                key={action.id}
                onClick={() => handleAction(action.id)}
                disabled={!action.isEnabled || actionLoading === action.id}
                size="lg"
                style={{ backgroundColor: themeColor }}
                data-testid={`button-action-${action.id}`}
              >
                {actionLoading === action.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </main>

      {showOtpModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-sm w-full">
            <CardHeader>
              <CardTitle>Verify Your Email</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!otpSent ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    For security, we need to verify your email before completing this action.
                  </p>
                  <Button onClick={sendOtp} className="w-full" data-testid="button-send-otp">
                    Send Verification Code
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Enter the 6-digit code sent to your email.
                  </p>
                  <Input
                    type="text"
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="text-center text-2xl tracking-widest"
                    maxLength={6}
                    data-testid="input-otp"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowOtpModal(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button onClick={verifyOtp} className="flex-1" disabled={otpCode.length !== 6} data-testid="button-verify-otp">
                      Verify
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function ComponentRenderer({ component, themeColor }: { component: RenderedComponent; themeColor: string }) {
  const content = component.content || {};

  switch (component.componentType) {
    case 'heading':
      const levelMap: Record<string | number, 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'> = {
        1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4', 5: 'h5', 6: 'h6',
        'h1': 'h1', 'h2': 'h2', 'h3': 'h3', 'h4': 'h4', 'h5': 'h5', 'h6': 'h6',
      };
      const HeadingTag = levelMap[content.level] || 'h2';
      const headingStyles = {
        h1: 'text-3xl font-bold',
        h2: 'text-2xl font-semibold',
        h3: 'text-xl font-medium',
        h4: 'text-lg font-medium',
        h5: 'text-base font-medium',
        h6: 'text-sm font-medium',
      };
      return (
        <HeadingTag className={headingStyles[HeadingTag] || headingStyles.h2} data-testid={`component-heading-${component.id}`}>
          {content.text}
        </HeadingTag>
      );

    case 'text_block':
      return (
        <p className="text-base leading-relaxed" data-testid={`component-text-${component.id}`}>
          {content.text}
        </p>
      );

    case 'callout':
      const calloutStyles = {
        info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: Info, iconColor: 'text-blue-500' },
        warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: AlertTriangle, iconColor: 'text-yellow-500' },
        success: { bg: 'bg-green-50', border: 'border-green-200', icon: CheckCircle, iconColor: 'text-green-500' },
        error: { bg: 'bg-red-50', border: 'border-red-200', icon: AlertCircle, iconColor: 'text-red-500' },
      };
      const style = calloutStyles[content.type as keyof typeof calloutStyles] || calloutStyles.info;
      const CalloutIcon = style.icon;
      return (
        <div className={`p-4 rounded-lg border ${style.bg} ${style.border}`} data-testid={`component-callout-${component.id}`}>
          <div className="flex gap-3">
            <CalloutIcon className={`h-5 w-5 ${style.iconColor} shrink-0 mt-0.5`} />
            <div>
              {content.title && <p className="font-medium mb-1">{content.title}</p>}
              <p className="text-sm">{content.message}</p>
            </div>
          </div>
        </div>
      );

    case 'status_widget':
      return (
        <Card data-testid={`component-status-${component.id}`}>
          <CardHeader>
            <CardTitle className="text-lg">Your Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {content.showManager && content.managerName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Your Account Manager</span>
                <span className="font-medium">{content.managerName}</span>
              </div>
            )}
            {content.showAccountsDue && content.nextAccountsDue && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Next Accounts Due</span>
                <span className="font-medium">{content.nextAccountsDue}</span>
              </div>
            )}
            {content.showConfirmationStatement && content.confirmationStatementNextDue && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Confirmation Statement Due</span>
                <span className="font-medium">{content.confirmationStatementNextDue}</span>
              </div>
            )}
          </CardContent>
        </Card>
      );

    case 'spacer':
      return <div style={{ height: content.height || 32 }} />;

    case 'image':
      return content.src ? (
        <figure className="text-center" data-testid={`component-image-${component.id}`}>
          <img src={content.src} alt={content.alt || ''} className="max-w-full rounded-lg mx-auto" />
          {content.caption && <figcaption className="text-sm text-muted-foreground mt-2">{content.caption}</figcaption>}
        </figure>
      ) : null;

    case 'table':
      return (
        <div className="overflow-x-auto" data-testid={`component-table-${component.id}`}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {content.headers?.map((header: string, i: number) => (
                  <th key={i} className="border p-2 bg-muted text-left font-medium">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.rows?.map((row: any, i: number) => (
                <tr key={i}>
                  {row.cells?.map((cell: string, j: number) => (
                    <td key={j} className="border p-2">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'faq_accordion':
      return (
        <Accordion type="single" collapsible className="w-full" data-testid={`component-faq-${component.id}`}>
          {content.items?.map((item: any, i: number) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      );

    case 'timeline':
      return (
        <div className="space-y-4 relative" data-testid={`component-timeline-${component.id}`}>
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted" />
          {content.items?.map((item: any, i: number) => (
            <div key={i} className="relative pl-10">
              <div className="absolute left-2.5 w-3 h-3 rounded-full" style={{ backgroundColor: themeColor }} />
              <div className="text-sm text-muted-foreground">{item.date}</div>
              <div className="font-medium">{item.title}</div>
              {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
            </div>
          ))}
        </div>
      );

    case 'video_embed':
      if (!content.url) return null;
      const getEmbedUrl = (url: string, type: string) => {
        if (type === 'youtube') {
          const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
          return match ? `https://www.youtube.com/embed/${match[1]}` : url;
        }
        if (type === 'vimeo') {
          const match = url.match(/vimeo\.com\/(\d+)/);
          return match ? `https://player.vimeo.com/video/${match[1]}` : url;
        }
        return url;
      };
      return (
        <div className="aspect-video" data-testid={`component-video-${component.id}`}>
          <iframe
            src={getEmbedUrl(content.url, content.type || 'youtube')}
            className="w-full h-full rounded-lg"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );

    default:
      return null;
  }
}
