import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { Mail, Loader2, KeyRound, ArrowLeft, CheckCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

const magicLinkFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const codeVerifySchema = z.object({
  code: z.string().min(4, "Verification code must be 4 digits").max(4, "Verification code must be 4 digits"),
});

type MagicLinkFormData = z.infer<typeof magicLinkFormSchema>;
type CodeVerifyFormData = z.infer<typeof codeVerifySchema>;

type FormState = "email_input" | "code_entry";

interface MagicLinkLoginFormProps {
  onSuccess?: () => void;
}

export default function MagicLinkLoginForm({ onSuccess }: MagicLinkLoginFormProps) {
  const [formState, setFormState] = useState<FormState>("email_input");
  const [sentEmail, setSentEmail] = useState<string>("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<MagicLinkFormData>({
    resolver: zodResolver(magicLinkFormSchema),
    defaultValues: {
      email: "",
    },
  });

  const codeForm = useForm<CodeVerifyFormData>({
    resolver: zodResolver(codeVerifySchema),
    defaultValues: {
      code: "",
    },
  });

  const magicLinkMutation = useMutation({
    mutationFn: async (data: MagicLinkFormData) => {
      return await apiRequest("POST", "/api/magic-link/request", data);
    },
    onSuccess: (data, variables) => {
      setFormState("code_entry");
      setSentEmail(variables.email);
      toast({
        title: "Magic Link Sent!",
        description: "Check your email for a magic link to sign in. The link will expire in 10 minutes.",
      });
    },
    onError: (error: any) => {
      // The API always returns 200, but handle network errors
      showFriendlyError({ error: error || "Failed to send magic link. Please check your internet connection and try again." });
    },
  });

  const codeVerifyMutation = useMutation({
    mutationFn: async (data: CodeVerifyFormData) => {
      return await apiRequest("POST", "/api/magic-link/verify", {
        code: data.code,
        email: sentEmail,
      });
    },
    onSuccess: async (data) => {
      toast({
        title: "Welcome!",
        description: "You have been successfully signed in with your verification code.",
      });
      
      // Refresh auth state to ensure Router recognizes user is authenticated
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      // Wait for auth state to update before navigation
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        } else {
          setLocation("/"); // Navigate to dashboard using client-side routing
        }
      }, 500);
    },
    onError: (error: any) => {
      console.error("Code verification error:", error);
      showFriendlyError({ error: error || "Invalid verification code. Please check your code and try again." });
    },
  });

  const onSubmit = (data: MagicLinkFormData) => {
    setFormState("email_input");
    magicLinkMutation.mutate(data);
  };

  const onCodeSubmit = (data: CodeVerifyFormData) => {
    codeVerifyMutation.mutate(data);
  };

  const handleBackToEmail = () => {
    setFormState("email_input");
    setSentEmail("");
    codeForm.reset();
  };

  // Code entry state - show success message + code input
  if (formState === "code_entry") {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-green-100 p-3">
              <Mail className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-green-700">Check Your Email</CardTitle>
          <CardDescription>
            We've sent a magic link to <strong>{sentEmail}</strong>. Check your email for a link, or enter the 4-digit code below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Two ways to sign in:</strong>
            </p>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
              <li>Click the magic link in your email</li>
              <li>Enter the 4-digit code manually below</li>
            </ul>
          </div>
          
          {/* Code verification form */}
          <Form {...codeForm}>
            <form onSubmit={codeForm.handleSubmit(onCodeSubmit)} className="space-y-4">
              <FormField
                control={codeForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center justify-center space-x-2">
                      <KeyRound className="w-4 h-4" />
                      <span>4-Digit Verification Code</span>
                    </FormLabel>
                    <FormControl>
                      <div className="flex justify-center">
                        <InputOTP 
                          maxLength={4} 
                          value={field.value} 
                          onChange={field.onChange}
                          data-testid="input-verification-code"
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
                  disabled={codeVerifyMutation.isPending}
                  className="w-full"
                  data-testid="button-verify-code"
                >
                  {codeVerifyMutation.isPending ? (
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
                  onClick={handleBackToEmail}
                  className="w-full"
                  data-testid="button-back-to-email"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Use Different Email
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center flex items-center justify-center space-x-2">
          <Mail className="w-5 h-5" />
          <span>Sign In with Magic Link</span>
        </CardTitle>
        <CardDescription className="text-center">
          Enter your email to receive a magic link for secure, password-free sign in
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      data-testid="input-magic-link-email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={magicLinkMutation.isPending}
              className="w-full"
              data-testid="button-magic-link-submit"
            >
              {magicLinkMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending Magic Link...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Magic Link
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}