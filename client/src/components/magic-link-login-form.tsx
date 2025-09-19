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
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const magicLinkFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type MagicLinkFormData = z.infer<typeof magicLinkFormSchema>;

interface MagicLinkLoginFormProps {
  onSuccess?: () => void;
}

export default function MagicLinkLoginForm({ onSuccess }: MagicLinkLoginFormProps) {
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  const form = useForm<MagicLinkFormData>({
    resolver: zodResolver(magicLinkFormSchema),
    defaultValues: {
      email: "",
    },
  });

  const magicLinkMutation = useMutation({
    mutationFn: async (data: MagicLinkFormData) => {
      const response = await apiRequest("POST", "/api/magic-link/request", data);
      return response.json();
    },
    onSuccess: (data) => {
      setIsSuccess(true);
      toast({
        title: "Magic Link Sent!",
        description: "Check your email for a magic link to sign in. The link will expire in 15 minutes.",
      });
      onSuccess?.();
    },
    onError: (error: any) => {
      // The API always returns 200, but handle network errors
      toast({
        title: "Request Failed",
        description: "Failed to send magic link. Please check your internet connection and try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: MagicLinkFormData) => {
    setIsSuccess(false);
    magicLinkMutation.mutate(data);
  };

  if (isSuccess) {
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
            We've sent a magic link to your email address. Click the link or use the 4-digit code to sign in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Two ways to sign in:</strong>
            </p>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
              <li>Click the magic link in your email</li>
              <li>Enter the 4-digit code manually</li>
            </ul>
          </div>
          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => setIsSuccess(false)}
              data-testid="button-send-another"
            >
              Send Another Link
            </Button>
          </div>
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