import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, CheckCircle2, XCircle, AlertCircle, Copy, Send } from "lucide-react";

interface DiagnosticInfo {
  serviceWorker: {
    supported: boolean;
    registered: boolean;
    state?: string;
    scriptURL?: string;
  };
  pushManager: {
    supported: boolean;
    permission: NotificationPermission;
    subscription: any | null;
  };
  vapid: {
    publicKey: string | null;
    error?: string;
  };
  browser: {
    userAgent: string;
    platform: string;
    isSafari: boolean;
    isChrome: boolean;
    isPWA: boolean;
  };
}

export default function PushDiagnostics() {
  const { toast } = useToast();
  const [diagnostics, setDiagnostics] = useState<DiagnosticInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      const info: DiagnosticInfo = {
        serviceWorker: {
          supported: 'serviceWorker' in navigator,
          registered: false,
        },
        pushManager: {
          supported: 'PushManager' in window,
          permission: 'default',
          subscription: null,
        },
        vapid: {
          publicKey: null,
        },
        browser: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
          isChrome: /chrome/i.test(navigator.userAgent),
          isPWA: window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true,
        },
      };

      // Check service worker
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          info.serviceWorker.registered = true;
          info.serviceWorker.state = registration.active?.state;
          info.serviceWorker.scriptURL = registration.active?.scriptURL;

          // Check push subscription
          if ('PushManager' in window) {
            const subscription = await registration.pushManager.getSubscription();
            info.pushManager.permission = Notification.permission;
            if (subscription) {
              info.pushManager.subscription = {
                endpoint: subscription.endpoint,
                keys: subscription.toJSON().keys,
              };
            }
          }
        } catch (error) {
          console.error('Service worker check failed:', error);
        }
      }

      // Get VAPID public key
      try {
        const response = await fetch('/api/push/vapid-public-key');
        const data = await response.json();
        info.vapid.publicKey = data.publicKey;
      } catch (error: any) {
        info.vapid.error = error.message;
      }

      setDiagnostics(info);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to run diagnostics",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Diagnostic info copied to clipboard",
    });
  };

  const testPushNotification = async () => {
    setIsTesting(true);
    try {
      const response = await fetch('/api/push/test', {
        method: 'POST',
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Test Sent!",
          description: data.message || "Check your device for the notification",
        });
      } else {
        toast({
          title: "Test Failed",
          description: data.message || "Failed to send test notification",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send test notification",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle2 className="w-5 h-5 text-green-600" />
    ) : (
      <XCircle className="w-5 h-5 text-red-600" />
    );
  };

  if (!diagnostics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const allGood = 
    diagnostics.serviceWorker.supported &&
    diagnostics.serviceWorker.registered &&
    diagnostics.pushManager.supported &&
    diagnostics.pushManager.permission === 'granted' &&
    diagnostics.pushManager.subscription !== null &&
    diagnostics.vapid.publicKey !== null;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Push Notification Diagnostics</h1>
          <p className="text-muted-foreground">
            Check your push notification configuration and troubleshoot issues
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={testPushNotification}
            disabled={isTesting || !diagnostics?.pushManager.subscription}
            data-testid="button-test-push"
          >
            <Send className={`w-4 h-4 mr-2 ${isTesting ? 'animate-pulse' : ''}`} />
            {isTesting ? 'Sending...' : 'Test Push'}
          </Button>
          <Button
            onClick={runDiagnostics}
            disabled={isLoading}
            variant="outline"
            data-testid="button-refresh-diagnostics"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Status */}
      <Card className="mb-6" data-testid="card-overall-status">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {allGood ? (
              <>
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                All Systems Operational
              </>
            ) : (
              <>
                <AlertCircle className="w-6 h-6 text-orange-600" />
                Issues Detected
              </>
            )}
          </CardTitle>
          <CardDescription>
            {allGood
              ? "Push notifications are properly configured and should work"
              : "There are configuration issues that need to be addressed"}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Browser & Environment */}
      <Card className="mb-6" data-testid="card-browser-info">
        <CardHeader>
          <CardTitle>Browser & Environment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">Browser:</span>
            <span className="text-sm text-muted-foreground">
              {diagnostics.browser.isSafari ? 'Safari' : diagnostics.browser.isChrome ? 'Chrome' : 'Other'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">Platform:</span>
            <span className="text-sm text-muted-foreground">{diagnostics.browser.platform}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">PWA Mode:</span>
            <Badge variant={diagnostics.browser.isPWA ? "default" : "secondary"}>
              {diagnostics.browser.isPWA ? 'Yes' : 'No'}
            </Badge>
          </div>
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium">User Agent:</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground text-right break-all max-w-md">
                {diagnostics.browser.userAgent}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(diagnostics.browser.userAgent)}
                data-testid="button-copy-useragent"
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service Worker Status */}
      <Card className="mb-6" data-testid="card-service-worker">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon(diagnostics.serviceWorker.registered)}
            Service Worker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">Supported:</span>
            <Badge variant={diagnostics.serviceWorker.supported ? "default" : "destructive"}>
              {diagnostics.serviceWorker.supported ? 'Yes' : 'No'}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">Registered:</span>
            <Badge variant={diagnostics.serviceWorker.registered ? "default" : "destructive"}>
              {diagnostics.serviceWorker.registered ? 'Yes' : 'No'}
            </Badge>
          </div>
          {diagnostics.serviceWorker.state && (
            <div className="flex items-center justify-between">
              <span className="font-medium">State:</span>
              <Badge variant="outline">{diagnostics.serviceWorker.state}</Badge>
            </div>
          )}
          {diagnostics.serviceWorker.scriptURL && (
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">Script URL:</span>
              <span className="text-xs text-muted-foreground text-right break-all">
                {diagnostics.serviceWorker.scriptURL}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Push Manager Status */}
      <Card className="mb-6" data-testid="card-push-manager">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon(diagnostics.pushManager.supported && diagnostics.pushManager.permission === 'granted')}
            Push Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">Supported:</span>
            <Badge variant={diagnostics.pushManager.supported ? "default" : "destructive"}>
              {diagnostics.pushManager.supported ? 'Yes' : 'No'}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">Permission:</span>
            <Badge 
              variant={
                diagnostics.pushManager.permission === 'granted' ? 'default' :
                diagnostics.pushManager.permission === 'denied' ? 'destructive' : 'secondary'
              }
            >
              {diagnostics.pushManager.permission}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">Subscribed:</span>
            <Badge variant={diagnostics.pushManager.subscription ? "default" : "secondary"}>
              {diagnostics.pushManager.subscription ? 'Yes' : 'No'}
            </Badge>
          </div>
          {diagnostics.pushManager.subscription && (
            <>
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">Endpoint:</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground text-right break-all max-w-md">
                    {diagnostics.pushManager.subscription.endpoint}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(diagnostics.pushManager.subscription.endpoint)}
                    data-testid="button-copy-endpoint"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">Keys:</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground text-right break-all max-w-md font-mono">
                    {JSON.stringify(diagnostics.pushManager.subscription.keys, null, 2)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(JSON.stringify(diagnostics.pushManager.subscription, null, 2))}
                    data-testid="button-copy-subscription"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* VAPID Configuration */}
      <Card className="mb-6" data-testid="card-vapid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon(diagnostics.vapid.publicKey !== null)}
            VAPID Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">Public Key:</span>
            <Badge variant={diagnostics.vapid.publicKey ? "default" : "destructive"}>
              {diagnostics.vapid.publicKey ? 'Configured' : 'Missing'}
            </Badge>
          </div>
          {diagnostics.vapid.publicKey && (
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">Key Value:</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground text-right break-all max-w-md font-mono">
                  {diagnostics.vapid.publicKey}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(diagnostics.vapid.publicKey!)}
                  data-testid="button-copy-vapid"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
          {diagnostics.vapid.error && (
            <div className="text-sm text-destructive">Error: {diagnostics.vapid.error}</div>
          )}
        </CardContent>
      </Card>

      {/* Troubleshooting Tips */}
      <Card data-testid="card-troubleshooting">
        <CardHeader>
          <CardTitle>Troubleshooting Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {!diagnostics.browser.isPWA && diagnostics.browser.isSafari && (
              <li className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 text-orange-600 shrink-0" />
                <span><strong>macOS Safari:</strong> Push notifications require the PWA to be installed. Go to File → Add to Dock (or Share → Add to Home Screen on iOS)</span>
              </li>
            )}
            {diagnostics.pushManager.permission === 'denied' && (
              <li className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 text-orange-600 shrink-0" />
                <span><strong>Permission Denied:</strong> You've blocked notifications. Go to browser settings to reset permissions for this site</span>
              </li>
            )}
            {diagnostics.pushManager.permission === 'default' && (
              <li className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 text-orange-600 shrink-0" />
                <span><strong>Not Subscribed:</strong> Enable push notifications from your user settings or profile page</span>
              </li>
            )}
            {!diagnostics.serviceWorker.registered && (
              <li className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 text-orange-600 shrink-0" />
                <span><strong>No Service Worker:</strong> Try refreshing the page or clearing browser cache</span>
              </li>
            )}
            {!diagnostics.vapid.publicKey && (
              <li className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 text-orange-600 shrink-0" />
                <span><strong>VAPID Missing:</strong> Server configuration issue - contact administrator</span>
              </li>
            )}
            {diagnostics.browser.isSafari && (
              <li className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 text-blue-600 shrink-0" />
                <span><strong>Safari Tip:</strong> Disable all content blockers before installing the PWA, as they can interfere with push notifications</span>
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
