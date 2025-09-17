import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, Users, Clock, CheckCircle, Settings } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Landing() {
  const [adminFormOpen, setAdminFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: "Admin user created successfully! You can now sign in.",
        });
        setAdminFormOpen(false);
        setFormData({ email: '', password: '', firstName: '', lastName: '' });
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
    <div className="min-h-screen bg-gradient-to-br from-background to-accent">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <BarChart3 className="text-primary-foreground text-xl" />
            </div>
            <h1 className="text-4xl font-bold text-foreground">BookFlow</h1>
          </div>
          <h2 className="text-2xl text-muted-foreground mb-4">
            Streamline Your Bookkeeping Workflow
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Manage bookkeeping projects efficiently with role-based access, kanban boards, 
            task tracking, and automated notifications.
          </p>
          
          <Button 
            size="lg" 
            className="px-8 py-4 text-lg"
            onClick={() => window.location.href = '/api/login'}
            data-testid="button-login"
          >
            Sign In to Get Started
          </Button>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-primary" />
                <span>Role-Based Access</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Four user roles - Admin, Manager, Client Manager, and Bookkeeper - each with 
                appropriate access levels and responsibilities.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-primary" />
                <span>Time Tracking</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Automatic time tracking for each project stage with detailed chronology 
                and duration monitoring.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-primary" />
                <span>Workflow Management</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Kanban boards with drag-and-drop functionality to move projects through 
                defined stages with proper assignment rules.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* How it Works */}
        <div className="text-center">
          <h3 className="text-2xl font-semibold mb-8">How BookFlow Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold">
                1
              </div>
              <h4 className="font-semibold mb-2">Upload Projects</h4>
              <p className="text-sm text-muted-foreground">
                Admin uploads CSV with client data and assignments
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold">
                2
              </div>
              <h4 className="font-semibold mb-2">Auto-Assignment</h4>
              <p className="text-sm text-muted-foreground">
                Projects automatically assigned to client managers
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold">
                3
              </div>
              <h4 className="font-semibold mb-2">Workflow Tracking</h4>
              <p className="text-sm text-muted-foreground">
                Move projects through stages with time tracking
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold">
                4
              </div>
              <h4 className="font-semibold mb-2">Completion</h4>
              <p className="text-sm text-muted-foreground">
                Projects marked complete with full audit trail
              </p>
            </div>
          </div>
        </div>

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
              </DialogHeader>
              <form onSubmit={handleAdminCreation} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    required
                    data-testid="input-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    required
                    data-testid="input-last-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    required
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
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
