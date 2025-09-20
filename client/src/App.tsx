import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Settings from "@/pages/settings";
import ProjectTypes from "@/pages/project-types";
import ProjectTypeDetail from "@/pages/project-type-detail";
import Users from "@/pages/users";
import Upload from "@/pages/upload";
import AllProjects from "@/pages/all-projects";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import Profile from "@/pages/profile";
import MagicLinkVerify from "@/pages/magic-link-verify";
import Clients from "@/pages/clients";
import Services from "@/pages/services";
import Admin from "@/pages/admin";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Public routes - always available */}
      <Route path="/magic-link-verify" component={MagicLinkVerify} />
      
      {/* Home route - conditional based on auth */}
      <Route path="/" component={isAuthenticated ? Dashboard : Landing} />
      
      {/* Protected routes - render regardless of auth state, let components handle auth */}
      <Route path="/projects" component={Projects} />
      <Route path="/projects/:id" component={ProjectDetail} />
      <Route path="/all-projects" component={AllProjects} />
      <Route path="/clients" component={Clients} />
      <Route path="/profile" component={Profile} />
      <Route path="/settings" component={Settings} />
      <Route path="/project-types" component={ProjectTypes} />
      <Route path="/settings/project-types/:id" component={ProjectTypeDetail} />
      <Route path="/users" component={Users} />
      <Route path="/services" component={Services} />
      <Route path="/upload" component={Upload} />
      <Route path="/admin" component={Admin} />
      
      {/* Catch-all NotFound route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
