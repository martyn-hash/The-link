import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Send } from 'lucide-react';
import { portalApi } from '@/lib/portalApi';
import { useToast } from '@/hooks/use-toast';
import { usePortalManifest } from '@/hooks/usePortalManifest';

export default function PortalLogin() {
  usePortalManifest();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: 'Email required',
        description: 'Please enter your email address',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await portalApi.auth.requestMagicLink(email);
      setEmailSent(true);
      toast({
        title: 'Check your email',
        description: 'If a portal account exists for this email, a login link has been sent.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send login link. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <MessageCircle className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-2xl">Client Portal</CardTitle>
          <CardDescription>
            {emailSent
              ? 'Check your email for the login link'
              : 'Enter your email to receive a login link'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!emailSent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  data-testid="input-portal-email"
                  className="text-base"
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
                data-testid="button-request-magic-link"
              >
                <Send className="mr-2 h-4 w-4" />
                {isSubmitting ? 'Sending...' : 'Send Login Link'}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-900 dark:text-blue-100">
                <p className="font-medium mb-1">Login link sent!</p>
                <p>Check your email inbox and click the link to access your portal.</p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setEmailSent(false);
                  setEmail('');
                }}
                data-testid="button-send-another"
              >
                Send Another Link
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
