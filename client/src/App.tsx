import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";
import { PWAUpdatePrompt } from "@/components/PWAUpdatePrompt";
import { PortalAuthProvider, usePortalAuth } from "@/contexts/PortalAuthContext";
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
import ClientServiceDetail from "@/pages/client-service-detail";
import People from "@/pages/people";
import PersonDetail from "@/pages/person-detail";
import Services from "@/pages/services";
import ScheduledServices from "@/pages/scheduled-services";
import ChChanges from "@/pages/ch-changes";
import Companies from "@/pages/companies";
import Tags from "@/pages/tags";
import Admin from "@/pages/admin";
import DataImport from "@/pages/data-import";
import PushDiagnostics from "@/pages/push-diagnostics";
import PortalLogin from "@/pages/portal/PortalLogin";
import PortalVerify from "@/pages/portal/PortalVerify";
import PortalThreadList from "@/pages/portal/PortalThreadList";
import PortalThreadDetail from "@/pages/portal/PortalThreadDetail";
import PortalNewThread from "@/pages/portal/PortalNewThread";
import Messages from "@/pages/messages";

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
      {/* Portal routes - separate auth system */}
      <Route path="/portal/login" component={PortalLogin} />
      <Route path="/portal/verify" component={PortalVerify} />
      <Route path="/portal/threads/new" component={PortalNewThread} />
      <Route path="/portal/threads/:id" component={PortalThreadDetail} />
      <Route path="/portal/threads" component={PortalThreadList} />
      <Route path="/portal">
        <Redirect to="/portal/threads" />
      </Route>

      {/* Public routes - always available */}
      <Route path="/magic-link-verify" component={MagicLinkVerify} />
      <Route path="/login" component={() => <Landing />} />
      
      {/* Home route - conditional based on auth */}
      <Route path="/" component={isAuthenticated ? Dashboard : Landing} />
      
      {/* Redirect /dashboard to root */}
      <Route path="/dashboard">
        <Redirect to="/" />
      </Route>
      
      {/* Protected routes - render regardless of auth state, let components handle auth */}
      <Route path="/messages" component={Messages} />
      <Route path="/projects" component={Projects} />
      <Route path="/projects/:id" component={ProjectDetail} />
      {/* Redirect old /all-projects route to new /projects route */}
      <Route path="/all-projects">
        <Redirect to="/projects" />
      </Route>
      <Route path="/clients" component={Clients} />
      <Route path="/clients/:id" component={ClientDetail} />
      <Route path="/client-service/:id" component={ClientServiceDetail} />
      <Route path="/people" component={People} />
      <Route path="/person/:id" component={PersonDetail} />
      <Route path="/profile" component={Profile} />
      <Route path="/settings" component={Settings} />
      <Route path="/project-types" component={ProjectTypes} />
      <Route path="/settings/project-types/:id" component={ProjectTypeDetail} />
      <Route path="/users" component={Users} />
      <Route path="/services" component={Services} />
      <Route path="/scheduled-services" component={ScheduledServices} />
      <Route path="/ch-changes" component={ChChanges} />
      <Route path="/companies" component={Companies} />
      <Route path="/tags" component={Tags} />
      <Route path="/upload" component={Upload} />
      <Route path="/admin" component={Admin} />
      <Route path="/admin/import" component={DataImport} />
      <Route path="/push-diagnostics" component={PushDiagnostics} />
      
      {/* Catch-all NotFound route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PortalAuthProvider>
        <TooltipProvider>
          <AppContent />
        </TooltipProvider>
      </PortalAuthProvider>
    </QueryClientProvider>
  );
}

function AppContent() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <Toaster />
      <Router />
      <PWAUpdatePrompt />
      {isAuthenticated && <PushNotificationPrompt />}
    </>
  );
}

export default App;
