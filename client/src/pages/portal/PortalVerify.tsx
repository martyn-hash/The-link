import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { portalApi } from '@/lib/portalApi';
import { usePortalAuth } from '@/contexts/PortalAuthContext';

export default function PortalVerify() {
  const [, setLocation] = useLocation();
  const { login, isAuthenticated, isLoading } = usePortalAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      setError('No verification token provided');
      return;
    }

    // If already authenticated, immediately redirect without showing UI (QR code reuse case)
    if (isAuthenticated) {
      setLocation('/portal/threads');
      return;
    }

    // Skip verification if still loading auth state
    if (isLoading) {
      return;
    }

    portalApi.auth.verifyMagicLink(token)
      .then((result) => {
        if (result.jwt) {
          login(result.jwt);
          setStatus('success');
          setTimeout(() => {
            setLocation('/portal/threads');
          }, 1500);
        } else {
          setStatus('error');
          setError('Invalid verification response');
        }
      })
      .catch((err) => {
        setStatus('error');
        setError(err.message || 'Verification failed');
      });
  }, [login, setLocation, isAuthenticated, isLoading]);

  // Don't render error/verification UI if user is already authenticated
  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">Already Logged In</CardTitle>
            <CardDescription>Redirecting to your portal...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            {status === 'verifying' && <Loader2 className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-spin" />}
            {status === 'success' && <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />}
            {status === 'error' && <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />}
          </div>
          <CardTitle className="text-2xl">
            {status === 'verifying' && 'Verifying...'}
            {status === 'success' && 'Success!'}
            {status === 'error' && 'Verification Failed'}
          </CardTitle>
          <CardDescription>
            {status === 'verifying' && 'Please wait while we verify your login link'}
            {status === 'success' && 'Redirecting to your portal...'}
            {status === 'error' && error}
          </CardDescription>
        </CardHeader>
        {status === 'error' && (
          <CardContent>
            <Button
              className="w-full"
              onClick={() => setLocation('/portal/login')}
              data-testid="button-back-to-login"
            >
              Back to Login
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
