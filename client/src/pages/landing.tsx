import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Users, Clock, CheckCircle, Settings, LogIn } from "lucide-react";
import MagicLinkLoginForm from "@/components/magic-link-login-form";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import logoPath from "@assets/resized_logo_1758262615320.png";

export default function Landing() {
  const [adminFormOpen, setAdminFormOpen] = useState(false);
  const [resetFormOpen, setResetFormOpen] = useState(false);
  const [loginFormData, setLoginFormData] = useState({
    email: '',
    password: ''
  });
  const [resetFormData, setResetFormData] = useState({
    email: '',
    newPassword: ''
  });
  const [adminFormData, setAdminFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: ''
  });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleLoginInputChange = (field: string, value: string) => {
    setLoginFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleResetInputChange = (field: string, value: string) => {
    setResetFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAdminInputChange = (field: string, value: string) => {
    setAdminFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginFormData),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: "Logged in successfully!",
        });
        // Refresh the page to trigger auth state update
        window.location.reload();
      } else {
        toast({
          title: "Error",
          description: data.message || "Invalid email or password",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to log in. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);

    try {
      const response = await fetch('/api/dev/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resetFormData),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: "Password reset successfully! You can now log in with your new password.",
        });
        setResetFormOpen(false);
        setResetFormData({ email: '', newPassword: '' });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to reset password",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleAdminCreation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/bootstrap-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(adminFormData),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: "Admin user created successfully! You can now sign in.",
        });
        setAdminFormOpen(false);
        setAdminFormData({ email: '', password: '', firstName: '', lastName: '' });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to create admin user",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create admin user. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-screen">
          {/* Left Column - Branding */}
          <div className="flex flex-col justify-center space-y-8">
            <div className="text-center lg:text-left">
              <img 
                src={logoPath} 
                alt="Growth Accountants Logo" 
                className="h-16 mx-auto lg:mx-0 mb-6"
                data-testid="img-logo"
              />
              <h1 className="text-5xl font-bold text-foreground mb-4" data-testid="text-brand">The Link</h1>
              <p className="text-xl text-muted-foreground">
                Project Management System
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                by Growth Accountants
              </p>
            </div>
          </div>

          {/* Right Column - Login Form */}
          <div className="flex flex-col justify-center">
            <div className="w-full max-w-md mx-auto">
              <Tabs defaultValue="password" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="password" data-testid="tab-password-login">
                    Password
                  </TabsTrigger>
                  <TabsTrigger value="magic-link" data-testid="tab-magic-link">
                    Magic Link
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="password" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-center flex items-center justify-center space-x-2">
                        <LogIn className="w-5 h-5" />
                        <span>Sign In</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="login-email">Email</Label>
                          <Input
                            id="login-email"
                            type="email"
                            value={loginFormData.email}
                            onChange={(e) => handleLoginInputChange('email', e.target.value)}
                            required
                            placeholder="Enter your email"
                            data-testid="input-login-email"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="login-password">Password</Label>
                          <Input
                            id="login-password"
                            type="password"
                            value={loginFormData.password}
                            onChange={(e) => handleLoginInputChange('password', e.target.value)}
                            required
                            placeholder="Enter your password"
                            data-testid="input-login-password"
                          />
                        </div>
                        <Button
                          type="submit"
                          disabled={isLoggingIn}
                          className="w-full"
                          data-testid="button-login"
                        >
                          {isLoggingIn ? "Signing In..." : "Sign In"}
                        </Button>
                        
                        <div className="text-center mt-4">
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={() => setResetFormOpen(true)}
                            className="text-sm text-muted-foreground hover:text-foreground"
                            data-testid="button-forgot-password"
                          >
                            Forgot Password?
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="magic-link" className="mt-6">
                  <MagicLinkLoginForm />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Password Reset Dialog */}
        <Dialog open={resetFormOpen} onOpenChange={setResetFormOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                Enter your email and new password to reset your account password.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={resetFormData.email}
                  onChange={(e) => handleResetInputChange('email', e.target.value)}
                  required
                  placeholder="Enter your email"
                  data-testid="input-reset-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-password">New Password</Label>
                <Input
                  id="reset-password"
                  type="password"
                  value={resetFormData.newPassword}
                  onChange={(e) => handleResetInputChange('newPassword', e.target.value)}
                  required
                  minLength={6}
                  placeholder="Enter new password"
                  data-testid="input-reset-password"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 6 characters
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResetFormOpen(false)}
                  className="flex-1"
                  data-testid="button-reset-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isResetting}
                  className="flex-1"
                  data-testid="button-reset-submit"
                >
                  {isResetting ? "Resetting..." : "Reset Password"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Discreet admin creation link at bottom */}
        <div className="text-center mt-16 pt-8 border-t border-muted">
          <Dialog open={adminFormOpen} onOpenChange={setAdminFormOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-foreground text-xs"
                data-testid="button-create-admin"
              >
                <Settings className="w-3 h-3 mr-1" />
                First time setup
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Initial Admin User</DialogTitle>
                <DialogDescription>
                  Create the first admin user account to set up your system. This will enable full access to all features.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAdminCreation} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={adminFormData.firstName}
                    onChange={(e) => handleAdminInputChange('firstName', e.target.value)}
                    required
                    data-testid="input-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={adminFormData.lastName}
                    onChange={(e) => handleAdminInputChange('lastName', e.target.value)}
                    required
                    data-testid="input-last-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={adminFormData.email}
                    onChange={(e) => handleAdminInputChange('email', e.target.value)}
                    required
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={adminFormData.password}
                    onChange={(e) => handleAdminInputChange('password', e.target.value)}
                    required
                    minLength={6}
                    data-testid="input-password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum 6 characters
                  </p>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAdminFormOpen(false)}
                    className="flex-1"
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1"
                    data-testid="button-submit"
                  >
                    {isSubmitting ? "Creating..." : "Create Admin"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
