import { Switch, Route, Redirect } from "wouter";
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
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import Profile from "@/pages/profile";
import MagicLinkVerify from "@/pages/magic-link-verify";
import Clients from "@/pages/clients";
import ClientDetail from "@/pages/client-detail";
import People from "@/pages/people";
import Services from "@/pages/services";
import ScheduledServices from "@/pages/scheduled-services";
import ChChanges from "@/pages/ch-changes";
import Tags from "@/pages/tags";
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
      <Route path="/login" component={() => <Landing />} />
      
      {/* Home route - conditional based on auth */}
      <Route path="/" component={isAuthenticated ? Dashboard : Landing} />
      
      {/* Protected routes - render regardless of auth state, let components handle auth */}
      <Route path="/projects" component={Projects} />
      <Route path="/projects/:id" component={ProjectDetail} />
      {/* Redirect old /all-projects route to new /projects route */}
      <Route path="/all-projects">
        <Redirect to="/projects" />
      </Route>
      <Route path="/clients" component={Clients} />
      <Route path="/clients/:id" component={ClientDetail} />
      <Route path="/people" component={People} />
      <Route path="/profile" component={Profile} />
      <Route path="/settings" component={Settings} />
      <Route path="/project-types" component={ProjectTypes} />
      <Route path="/settings/project-types/:id" component={ProjectTypeDetail} />
      <Route path="/users" component={Users} />
      <Route path="/services" component={Services} />
      <Route path="/scheduled-services" component={ScheduledServices} />
      <Route path="/ch-changes" component={ChChanges} />
      <Route path="/tags" component={Tags} />
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
