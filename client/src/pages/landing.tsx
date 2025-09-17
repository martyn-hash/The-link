import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, Clock, CheckCircle } from "lucide-react";

export default function Landing() {
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
      </div>
    </div>
  );
}
