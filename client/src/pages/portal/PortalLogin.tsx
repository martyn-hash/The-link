import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Send, Mail } from 'lucide-react';
import { portalApi } from '@/lib/portalApi';
import { useToast } from '@/hooks/use-toast';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export default function PortalLogin() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();
  const codeInputRef = useRef<HTMLDivElement>(null);

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
      toast({
        title: 'Email required',
        description: 'Please enter your email address',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingCode(true);
    try {
      await portalApi.auth.requestCode(email);
      setCodeSent(true);
      toast({
        title: 'Code sent!',
        description: 'Check your email for your 6-digit login code.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send code. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code || code.length !== 6) {
      toast({
        title: 'Code required',
        description: 'Please enter the 6-digit code from your email',
        variant: 'destructive',
      });
      return;
    }

    setIsVerifying(true);
    try {
      const result = await portalApi.auth.verifyCode(email, code);
      
      if (result.jwt) {
        // Store JWT in localStorage
        localStorage.setItem('portal_jwt', result.jwt);
        
        // Redirect to portal home
        window.location.href = '/portal';
      }
    } catch (error: any) {
      toast({
        title: 'Invalid code',
        description: error.message || 'The code you entered is incorrect or expired. Please try again.',
        variant: 'destructive',
      });
      setCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A7BBF]/10 via-white to-[#76CA23]/10 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-[#0A7BBF]/20">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-[#0A7BBF] to-[#0869A3] rounded-full flex items-center justify-center shadow-lg">
            <MessageCircle className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl bg-gradient-to-r from-[#0A7BBF] to-[#0869A3] bg-clip-text text-transparent">
            Client Portal Login
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
