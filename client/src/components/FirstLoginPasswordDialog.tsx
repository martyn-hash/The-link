import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { Lock, CheckCircle } from "lucide-react";

export function FirstLoginPasswordDialog() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  // Check if user needs to set up password
  const { data: passwordStatus } = useQuery<{ needsPasswordSetup: boolean }>({
    queryKey: ["/api/auth/password-setup-status"],
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  useEffect(() => {
    if (passwordStatus?.needsPasswordSetup) {
      setIsOpen(true);
    }
  }, [passwordStatus]);

  const setPasswordMutation = useMutation({
    mutationFn: async (newPassword: string) => {
      return await apiRequest("POST", "/api/auth/set-password", {
        password: newPassword,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/password-setup-status"] });
      toast({
        title: "Password set successfully",
        description: "You can now use your password to log in to The Link.",
      });
      setIsOpen(false);
      setPassword("");
      setConfirmPassword("");
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 8) {
      showFriendlyError({ error: "Password must be at least 8 characters long" });
      return;
    }
    
    if (password !== confirmPassword) {
      showFriendlyError({ error: "Passwords don't match. Please make sure both passwords are the same." });
      return;
    }
    
    setPasswordMutation.mutate(password);
  };

  if (!passwordStatus?.needsPasswordSetup) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-6 h-6 text-primary" />
            <DialogTitle>Welcome to The Link!</DialogTitle>
          </div>
          <DialogDescription>
            Please set up your password to secure your account. You'll use this password along with your email to log in to https://flow.growth.accountants
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="new-password">Password</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password (min 8 characters)"
              data-testid="input-new-password"
              required
              minLength={8}
            />
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              data-testid="input-confirm-password"
              required
            />
          </div>
          <div className="bg-muted p-3 rounded-md text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Password Requirements:</p>
                <ul className="list-disc list-inside mt-1 text-muted-foreground">
                  <li>At least 8 characters long</li>
                  <li>Use a unique password you don't use elsewhere</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={setPasswordMutation.isPending || !password || !confirmPassword}
              data-testid="button-set-password"
              className="w-full"
            >
              {setPasswordMutation.isPending ? 'Setting Password...' : 'Set Password'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
