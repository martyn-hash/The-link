import { useState, useEffect } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, BellOff, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function PushNotificationPrompt() {
  const [isDismissed, setIsDismissed] = useState(false);
  const { isSupported, isSubscribed, permission, isLoading, subscribe, unsubscribe } = usePushNotifications();
  const { toast } = useToast();

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
