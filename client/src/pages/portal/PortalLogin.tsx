import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Send, Mail } from 'lucide-react';
import { portalApi } from '@/lib/portalApi';
import { useToast } from '@/hooks/use-toast';
import { showFriendlyError } from '@/lib/friendlyErrors';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import logoPath from "@assets/full_logo_transparent_600_1761924125378.png";

const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes (same as backend)

export default function PortalLogin() {
  const [email, setEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      // Check if stored session is expired
      const timestamp = localStorage.getItem('portal_code_timestamp');
      if (timestamp) {
        const elapsed = Date.now() - parseInt(timestamp, 10);
        if (elapsed > CODE_EXPIRY_MS) {
          // Session expired, clear everything
          localStorage.removeItem('portal_login_email');
          localStorage.removeItem('portal_code_sent');
          localStorage.removeItem('portal_code_timestamp');
          return '';
        }
      }
      return localStorage.getItem('portal_login_email') || '';
    }
    return '';
  });
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(() => {
    if (typeof window !== 'undefined') {
      // Check if stored session is expired
      const timestamp = localStorage.getItem('portal_code_timestamp');
      if (timestamp) {
        const elapsed = Date.now() - parseInt(timestamp, 10);
        if (elapsed > CODE_EXPIRY_MS) {
          // Session expired, clear everything
          localStorage.removeItem('portal_login_email');
          localStorage.removeItem('portal_code_sent');
          localStorage.removeItem('portal_code_timestamp');
          return false;
        }
      }
      return localStorage.getItem('portal_code_sent') === 'true';
    }
    return false;
  });
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();
  const codeInputRef = useRef<HTMLDivElement>(null);

  // Persist email and codeSent state to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (email) {
      localStorage.setItem('portal_login_email', email);
    } else {
      localStorage.removeItem('portal_login_email');
    }
  }, [email]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (codeSent) {
      localStorage.setItem('portal_code_sent', 'true');
      // Don't set timestamp here - it's set in handleRequestCode when code is actually sent
    } else {
      localStorage.removeItem('portal_code_sent');
      localStorage.removeItem('portal_code_timestamp');
    }
  }, [codeSent]);

  // Focus code input when code is sent
  useEffect(() => {
    if (codeSent && codeInputRef.current) {
      // Small delay to ensure the input is enabled
      setTimeout(() => {
        const firstInput = codeInputRef.current?.querySelector('input');
        firstInput?.focus();
      }, 100);
    }
  }, [codeSent]);

  const handleRequestCode = async () => {
    if (!email) {
      showFriendlyError({ error: 'Please enter your email address' });
      return;
    }

    setIsSendingCode(true);
    try {
      await portalApi.auth.requestCode(email);
      setCodeSent(true);
      
      // Set timestamp when code is actually sent (not during mount/restore)
      if (typeof window !== 'undefined') {
        localStorage.setItem('portal_code_timestamp', Date.now().toString());
      }
      
      toast({
        title: 'Code sent!',
        description: 'Check your email for your 6-digit login code.',
      });
    } catch (error) {
      showFriendlyError({ error: error instanceof Error ? error : 'Failed to send code. Please try again.' });
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code || code.length !== 6) {
      showFriendlyError({ error: 'Please enter the 6-digit code from your email' });
      return;
    }

    setIsVerifying(true);
    try {
      const result = await portalApi.auth.verifyCode(email, code);
      
      if (result.jwt) {
        if (typeof window !== 'undefined') {
          // Store JWT in localStorage
          localStorage.setItem('portal_jwt', result.jwt);
          
          // Clear login state from localStorage
          localStorage.removeItem('portal_login_email');
          localStorage.removeItem('portal_code_sent');
          localStorage.removeItem('portal_code_timestamp');
        }
        
        // Redirect to portal home
        window.location.href = '/portal';
      }
    } catch (error: any) {
      showFriendlyError({ error: error.message || 'The code you entered is incorrect or expired. Please try again.' });
      setCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A7BBF]/10 via-white to-[#76CA23]/10 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-[#0A7BBF]/20">
        <CardHeader className="text-center">
          <img 
            src={logoPath} 
            alt="Growth Accountants" 
            className="h-16 mx-auto mb-4"
            data-testid="img-logo"
          />
          <CardTitle className="text-2xl font-bold text-[#0A7BBF] dark:text-[#76CA23]">
            The Link
          </CardTitle>
          <CardDescription>
            Enter your email and we'll send you a login code
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerifyCode} className="space-y-6">
            {/* Email Field - Always Visible */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Email Address
              </label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={codeSent}
                  data-testid="input-portal-email"
                  className="text-base flex-1"
                  autoFocus
                />
                {!codeSent && (
                  <Button
                    type="button"
                    onClick={handleRequestCode}
                    className="bg-gradient-to-r from-[#0A7BBF] to-[#0869A3] hover:from-[#0869A3] hover:to-[#065580] text-white shadow-lg"
                    disabled={isSendingCode || !email}
                    data-testid="button-request-code"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {codeSent && (
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  Code sent! Check your email.
                </p>
              )}
            </div>

            {/* Code Field - Always Visible but Disabled Until Code Sent */}
            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Verification Code
              </label>
              <div ref={codeInputRef} className={`${!codeSent ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={setCode}
                    disabled={!codeSent}
                    data-testid="input-verification-code"
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="w-12 h-14 text-xl" />
                      <InputOTPSlot index={1} className="w-12 h-14 text-xl" />
                      <InputOTPSlot index={2} className="w-12 h-14 text-xl" />
                      <InputOTPSlot index={3} className="w-12 h-14 text-xl" />
                      <InputOTPSlot index={4} className="w-12 h-14 text-xl" />
                      <InputOTPSlot index={5} className="w-12 h-14 text-xl" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              {!codeSent && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Enter your email above to receive a code
                </p>
              )}
              {codeSent && (
                <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                  Code expires in 10 minutes
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#0A7BBF] to-[#0869A3] hover:from-[#0869A3] hover:to-[#065580] text-white shadow-lg"
              disabled={!codeSent || isVerifying || code.length !== 6}
              data-testid="button-verify-code"
            >
              {isVerifying ? 'Verifying...' : 'Login'}
            </Button>

            {/* Change Email Option */}
            {codeSent && (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-sm"
                onClick={() => {
                  setCodeSent(false);
                  setCode('');
                  setEmail('');
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('portal_login_email');
                    localStorage.removeItem('portal_code_sent');
                    localStorage.removeItem('portal_code_timestamp');
                  }
                }}
                data-testid="button-change-email"
              >
                Use Different Email
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
