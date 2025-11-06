import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogIn } from "lucide-react";
import MagicLinkLoginForm from "@/components/magic-link-login-form";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import logoPath from "@assets/full_logo_transparent_600_1761924125378.png";

export default function Landing() {
  const [loginFormData, setLoginFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { toast } = useToast();

  const handleLoginInputChange = (field: string, value: string) => {
    setLoginFormData(prev => ({ ...prev, [field]: value }));
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
      </div>
    </div>
  );
}
