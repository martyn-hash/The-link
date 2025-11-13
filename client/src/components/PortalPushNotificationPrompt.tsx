import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import logoPath from '@assets/full_logo_transparent_600_1759655632382.png';

export function PortalPushNotificationPrompt() {
  const [location] = useLocation();
  const [isDismissed, setIsDismissed] = useState(false);
  const { isSupported, isSubscribed, permission, isLoading, subscribe } = usePushNotifications();
  const { toast } = useToast();

  useEffect(() => {
    const dismissed = localStorage.getItem('portal-push-notification-prompt-dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('portal-push-notification-prompt-dismissed', 'true');
  };

  const handleEnable = async () => {
    const success = await subscribe();
    if (success) {
      toast({
        title: 'Push messages enabled',
        description: 'You will now receive important updates and reminders.',
      });
      handleDismiss();
    } else {
      toast({
        title: 'Unable to enable push messages',
        description: 'Please check your browser permissions and try again.',
        variant: 'destructive',
      });
    }
  };

  // Don't show on signature request builder pages (interferes with PDF interaction)
  const isSignatureBuilderPage = location.includes('/signature-requests/new');
  
  // Don't show if not supported, already dismissed, loading, already subscribed, or on signature builder
  if (!isSupported || isDismissed || isLoading || isSubscribed || permission === 'denied' || isSignatureBuilderPage) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-gradient-to-br from-[#0B5B7E] to-[#8BC63E] flex items-center justify-center p-6"
      data-testid="container-portal-push-prompt"
    >
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-lg w-full p-8 md:p-12 space-y-8 animate-in zoom-in-95">
        {/* Logo */}
        <div className="flex justify-center">
          <img 
            src={logoPath} 
            alt="Growth Accountants" 
            className="h-24 md:h-32 w-auto"
            data-testid="img-logo"
          />
        </div>

        {/* Icon and Text */}
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="bg-gradient-to-br from-[#0B5B7E] to-[#8BC63E] p-6 rounded-full">
              <Bell className="h-12 w-12 text-white" />
            </div>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100">
            Please Enable Push Notifications
          </h1>
          
          <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed max-w-md mx-auto">
            Stay informed about important updates, deadline reminders, and messages from your accountant. Never miss critical information.
          </p>
        </div>

        {/* Buttons */}
        <div className="space-y-4">
          <Button
            onClick={handleEnable}
            disabled={isLoading}
            size="lg"
            className="w-full text-lg py-6 bg-gradient-to-r from-[#0B5B7E] to-[#8BC63E] hover:opacity-90 text-white font-semibold shadow-lg"
            data-testid="button-allow-push-messages"
          >
            <Bell className="h-6 w-6 mr-3" />
            Allow Push Messages
          </Button>
          
          <Button
            variant="ghost"
            size="lg"
            onClick={handleDismiss}
            className="w-full text-lg py-6 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            data-testid="button-maybe-later"
          >
            Maybe Later
          </Button>
        </div>

        {/* Privacy note */}
        <p className="text-center text-sm text-gray-500 dark:text-gray-500">
          You can change your notification preferences at any time from your profile settings
        </p>
      </div>
    </div>
  );
}
