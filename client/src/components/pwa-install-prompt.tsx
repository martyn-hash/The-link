import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Download, Share, Plus, MoreHorizontal } from 'lucide-react';
import { detectDevice, shouldShowIOSInstructions, shouldShowAndroidPrompt } from '@/lib/pwaUtils';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [device, setDevice] = useState(detectDevice());
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDevice(detectDevice());

    // Check if user has dismissed before
    const isDismissed = localStorage.getItem('pwa-install-dismissed') === 'true';
    if (isDismissed) {
      setDismissed(true);
      return;
    }

    // For iOS, show instructions if eligible
    if (shouldShowIOSInstructions(device)) {
      // Delay showing prompt slightly for better UX
      setTimeout(() => setShowPrompt(true), 2000);
    }

    // For Android, listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const installEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(installEvent);
      
      if (shouldShowAndroidPrompt(device)) {
        setTimeout(() => setShowPrompt(true), 2000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
      setDismissed(true);
    }
    
    setDeferredPrompt(null);
  };

  if (dismissed || !showPrompt || device.isStandalone) {
    return null;
  }

  // iOS Instructions
  if (shouldShowIOSInstructions(device)) {
    const isIOS26Plus = device.version && device.version >= 26;
    
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 max-w-md mx-auto animate-in slide-in-from-bottom-4">
        <style>{`
          @keyframes pulse-arrow {
            0%, 100% { 
              opacity: 1; 
              transform: translateY(0); 
            }
            50% { 
              opacity: 0.6; 
              transform: translateY(-4px); 
            }
          }
          .pulsing-icon {
            animation: pulse-arrow 2s ease-in-out infinite;
          }
        `}</style>
        <Card className="shadow-2xl border-2 border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Download className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base" data-testid="text-pwa-install-title">Install The Link App</CardTitle>
                  <CardDescription className="text-xs">Quick access from your home screen</CardDescription>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 -mt-1 -mr-2" 
                onClick={handleDismiss}
                data-testid="button-dismiss-pwa"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
            <div className="space-y-2 text-sm">
              {isIOS26Plus ? (
                <>
                  {/* iOS 26+ - Share button is in 3-dot menu */}
                  <div className="flex items-start gap-3 p-2 bg-blue-50 dark:bg-blue-950 rounded-lg relative">
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                      1
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <span>Tap</span>
                      <div className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 rounded border relative">
                        <MoreHorizontal className="h-4 w-4 text-blue-600 pulsing-icon" />
                        <span className="text-xs font-medium">(3 dots)</span>
                      </div>
                      <span>in bottom right</span>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                      2
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <span>Tap</span>
                      <div className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 rounded border">
                        <Share className="h-4 w-4 text-blue-600 pulsing-icon" />
                        <span className="text-xs font-medium">Share</span>
                      </div>
                      <span>from the menu</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                      3
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <span>Select</span>
                      <div className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 rounded border">
                        <Plus className="h-4 w-4 text-blue-600" />
                        <span className="text-xs font-medium">Add to Home Screen</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                      4
                    </div>
                    <div className="flex-1">
                      <span>Tap <strong>Add</strong> to install</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* iOS <26 - Share button directly visible */}
                  <div className="flex items-start gap-3 p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                      1
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <span>Tap the</span>
                      <div className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 rounded border">
                        <Share className="h-4 w-4 text-blue-600 pulsing-icon" />
                        <span className="text-xs font-medium">Share</span>
                      </div>
                      <span>button</span>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                      2
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <span>Select</span>
                      <div className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 rounded border">
                        <Plus className="h-4 w-4 text-blue-600" />
                        <span className="text-xs font-medium">Add to Home Screen</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                      3
                    </div>
                    <div className="flex-1">
                      <span>Tap <strong>Add</strong> to install</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground text-center">
                {isIOS26Plus ? 'iOS 26+' : `iOS ${device.version || 'supported'}`} • Works in Safari only
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Android Native Install Prompt
  if (shouldShowAndroidPrompt(device) && deferredPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 max-w-md mx-auto animate-in slide-in-from-bottom-4">
        <Card className="shadow-2xl border-2 border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Download className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base" data-testid="text-pwa-install-title">Install The Link App</CardTitle>
                  <CardDescription className="text-xs">Get quick access from your home screen</CardDescription>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 -mt-1 -mr-2" 
                onClick={handleDismiss}
                data-testid="button-dismiss-pwa"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="space-y-3">
              <div className="p-3 bg-primary/5 rounded-lg">
                <p className="text-sm text-muted-foreground mb-3">
                  Install this app for faster access and a better experience
                </p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Launches instantly from your home screen</li>
                  <li>• Works offline when available</li>
                  <li>• Feels like a native app</li>
                </ul>
              </div>
              
              <Button 
                onClick={handleAndroidInstall} 
                className="w-full"
                data-testid="button-install-pwa"
              >
                <Download className="h-4 w-4 mr-2" />
                Install Now
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Android {device.version || ''} • Takes just a second
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
