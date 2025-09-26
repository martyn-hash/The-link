import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { Mail, CheckCircle, AlertCircle, Loader2, KeyRound } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

const manualVerifySchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  code: z.string().min(4, "Verification code must be 4 digits").max(4, "Verification code must be 4 digits"),
});

type ManualVerifyFormData = z.infer<typeof manualVerifySchema>;

interface VerificationState {
  status: "loading" | "token_success" | "manual_form" | "error";
  message?: string;
  error?: string;
}

export default function MagicLinkVerify() {
  const [, setLocation] = useLocation();
  const [verificationState, setVerificationState] = useState<VerificationState>({ status: "loading" });
  const { toast } = useToast();

  const form = useForm<ManualVerifyFormData>({
    resolver: zodResolver(manualVerifySchema),
    defaultValues: {
      email: "",
      code: "",
    },
  });

  // Token verification mutation
  const tokenVerifyMutation = useMutation({
    mutationFn: async (token: string) => {
      return await apiRequest("POST", "/api/magic-link/verify", { token });
    },
    onSuccess: async (data) => {
      toast({
        title: "Welcome!",
        description: "You have been successfully signed in with your magic link.",
      });
      setVerificationState({ status: "token_success", message: "Refreshing authentication..." });
      
      // Refresh auth state to ensure Router recognizes user is authenticated
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      // Wait for auth state to update before navigation
      setTimeout(() => {
        setVerificationState({ status: "token_success", message: "Redirecting to dashboard..." });
        setTimeout(() => {
          setLocation("/"); // Navigate to dashboard using client-side routing
        }, 500);
      }, 1000);
    },
    onError: (error: any) => {
      console.error("Token verification error:", error);
      setVerificationState({
        status: "error",
        error: "The magic link is invalid, expired, or has already been used. Please request a new one or try manual verification below.",
      });
    },
  });

  // Manual code verification mutation
  const manualVerifyMutation = useMutation({
    mutationFn: async (data: ManualVerifyFormData) => {
      return await apiRequest("POST", "/api/magic-link/verify", {
        code: data.code,
        email: data.email,
      });
    },
    onSuccess: async (data) => {
      toast({
        title: "Welcome!",
        description: "You have been successfully signed in with your verification code.",
      });
      setVerificationState({ status: "token_success", message: "Refreshing authentication..." });
      
      // Refresh auth state to ensure Router recognizes user is authenticated
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      // Wait for auth state to update before navigation
      setTimeout(() => {
        setVerificationState({ status: "token_success", message: "Redirecting to dashboard..." });
        setTimeout(() => {
          setLocation("/"); // Navigate to dashboard using client-side routing
        }, 500);
      }, 1000);
    },
    onError: (error: any) => {
      console.error("Manual verification error:", error);
      const errorMessage = error.message || "Invalid verification code or email. Please check your details and try again.";
      toast({
        title: "Verification Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Extract token from URL query parameters and auto-verify
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");

    if (token) {
      // Clear token from URL immediately after extraction for security
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("token");
      window.history.replaceState({}, document.title, newUrl.pathname + newUrl.search);
      
      // Auto-verify token
      tokenVerifyMutation.mutate(token);
    } else {
      // No token found, show manual form
      setVerificationState({ status: "manual_form" });
    }
  }, []);

  const onManualSubmit = (data: ManualVerifyFormData) => {
    manualVerifyMutation.mutate(data);
  };

  const handleBackToLogin = () => {
    setLocation("/");
  };

  // Loading state during initial token verification
  if (verificationState.status === "loading" || tokenVerifyMutation.isPending) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-primary/10 p-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            </div>
            <CardTitle>Verifying Magic Link</CardTitle>
            <CardDescription>
              Please wait while we verify your magic link...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Success state
  if (verificationState.status === "token_success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-green-700">Sign In Successful!</CardTitle>
            <CardDescription>
              {verificationState.message || "You will be redirected momentarily..."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Error or manual form state
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary flex items-center justify-center">
      <div className="w-full max-w-md mx-4 space-y-6">
        {/* Error message if token verification failed */}
        {verificationState.status === "error" && (
          <Card className="border-destructive">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-red-100 p-3">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
              </div>
              <CardTitle className="text-red-700">Magic Link Issue</CardTitle>
              <CardDescription className="text-red-600">
                {verificationState.error}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Manual verification form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center flex items-center justify-center space-x-2">
              <KeyRound className="w-5 h-5" />
              <span>Enter Verification Code</span>
            </CardTitle>
            <CardDescription className="text-center">
              Enter the 4-digit code sent to your email along with your email address
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onManualSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Enter your email address"
                          {...field}
                          data-testid="input-verify-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>4-Digit Verification Code</FormLabel>
                      <FormControl>
                        <div className="flex justify-center">
                          <InputOTP 
                            maxLength={4} 
                            value={field.value} 
                            onChange={field.onChange}
                            data-testid="input-verify-code"
                          >
                            <InputOTPGroup>
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                              <InputOTPSlot index={2} />
                              <InputOTPSlot index={3} />
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3">
                  <Button
                    type="submit"
                    disabled={manualVerifyMutation.isPending}
                    className="w-full"
                    data-testid="button-verify-code"
                  >
                    {manualVerifyMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Verify & Sign In
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBackToLogin}
                    className="w-full"
                    data-testid="button-back-to-login"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Back to Sign In
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}