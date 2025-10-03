import { useState, useEffect } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, BellOff, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import logoPath from '@assets/full_logo_transparent_600_1759469504917.png';

export function PushNotificationPrompt() {
  const [isDismissed, setIsDismissed] = useState(false);
  const { isSupported, isSubscribed, permission, isLoading, subscribe, unsubscribe } = usePushNotifications();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    const dismissed = localStorage.getItem('push-notification-prompt-dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('push-notification-prompt-dismissed', 'true');
  };

  const handleEnable = async () => {
    const success = await subscribe();
    if (success) {
      toast({
        title: 'Notifications enabled',
        description: 'You will now receive push notifications for important updates.',
      });
      handleDismiss();
    } else {
      toast({
        title: 'Failed to enable notifications',
        description: 'Please check your browser permissions and try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDisable = async () => {
    const success = await unsubscribe();
    if (success) {
      localStorage.removeItem('push-notification-prompt-dismissed');
      setIsDismissed(false);
      toast({
        title: 'Notifications disabled',
        description: 'You will no longer receive push notifications.',
      });
    } else {
      toast({
        title: 'Failed to disable notifications',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    }
  };

  if (!isSupported || isDismissed || isLoading) {
    return null;
  }

  if (isSubscribed) {
    return null;
  }

  if (permission === 'denied') {
    if (isMobile) {
      return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" data-testid="container-push-denied">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-8 space-y-6 animate-in zoom-in-95">
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="h-8 w-8 p-0 rounded-full"
                data-testid="button-dismiss-denied"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="flex justify-center">
              <img src={logoPath} alt="Growth Accountants" className="h-20 w-auto" />
            </div>

            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-full">
                  <BellOff className="h-10 w-10 text-red-600 dark:text-red-400" />
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Notifications Blocked
              </h2>
              
              <p className="text-gray-600 dark:text-gray-400 text-base leading-relaxed">
                You've blocked notifications. To enable them and receive important deadline reminders, please update your browser settings.
              </p>
            </div>

            <Button
              onClick={handleDismiss}
              size="lg"
              className="w-full"
              data-testid="button-dismiss-denied-confirm"
            >
              Got It
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-md animate-in slide-in-from-bottom-5" data-testid="container-push-denied">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-900 shadow-lg" data-testid="card-push-denied">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <BellOff className="h-5 w-5 text-red-600 dark:text-red-400" />
                <CardTitle className="text-sm font-medium text-red-900 dark:text-red-100">
                  Notifications Blocked
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="h-6 w-6 p-0 text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100"
                data-testid="button-dismiss-denied"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription className="text-red-700 dark:text-red-300">
              You've blocked notifications. To enable them, please update your browser settings.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" data-testid="container-push-prompt">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-8 space-y-6 animate-in zoom-in-95">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-8 w-8 p-0 rounded-full"
              data-testid="button-dismiss-prompt"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="flex justify-center">
            <img src={logoPath} alt="Growth Accountants" className="h-20 w-auto" />
          </div>

          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full">
                <Bell className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Stay On Track
            </h2>
            
            <p className="text-gray-600 dark:text-gray-400 text-base leading-relaxed">
              Enable notifications so we can remind you about your deadlines and other important information. Never miss a critical update again.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleEnable}
              disabled={isLoading}
              size="lg"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-enable-notifications"
            >
              <Bell className="h-5 w-5 mr-2" />
              Enable Notifications
            </Button>
            
            <Button
              variant="ghost"
              size="lg"
              onClick={handleDismiss}
              className="w-full"
              data-testid="button-not-now"
            >
              Not Now
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md animate-in slide-in-from-bottom-5" data-testid="container-push-prompt">
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-900 shadow-lg" data-testid="card-push-prompt">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Stay Updated
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0 text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
              data-testid="button-dismiss-prompt"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription className="text-blue-700 dark:text-blue-300">
            Enable notifications to receive important updates about your projects and tasks.
          </CardDescription>
        </CardHeader>
        <CardFooter className="pt-0 flex gap-2">
          <Button
            onClick={handleEnable}
            disabled={isLoading}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-600"
            data-testid="button-enable-notifications"
          >
            <Bell className="h-4 w-4 mr-2" />
            Enable Notifications
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900"
            data-testid="button-not-now"
          >
            Not Now
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
