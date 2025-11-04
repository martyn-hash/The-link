import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";
import { PortalPushNotificationPrompt } from "@/components/PortalPushNotificationPrompt";
import { PWAUpdatePrompt } from "@/components/PWAUpdatePrompt";
import { FirstLoginPasswordDialog } from "@/components/FirstLoginPasswordDialog";
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
import TaskTemplateCategories from "@/pages/task-template-categories";
import TaskTemplates from "@/pages/task-templates";
import TaskTemplateEdit from "@/pages/task-template-edit";
import TaskTemplateSectionQuestions from "@/pages/task-template-section-questions";
import CustomRequestEdit from "@/pages/custom-request-edit";
import TaskSubmissions from "@/pages/task-submissions";
import TaskSubmissionDetail from "@/pages/task-submission-detail";
import TaskInstanceDetail from "@/pages/task-instance-detail";
import Admin from "@/pages/admin";
import AdminTaskTypes from "@/pages/admin-task-types";
import DataImport from "@/pages/data-import";
import PushDiagnostics from "@/pages/push-diagnostics";
import PushNotificationTemplates from "@/pages/push-notification-templates";
import PortalLogin from "@/pages/portal/PortalLogin";
import PortalVerify from "@/pages/portal/PortalVerify";
import PortalInstall from "@/pages/portal/PortalInstall";
import PortalThreadList from "@/pages/portal/PortalThreadList";
import PortalThreadDetail from "@/pages/portal/PortalThreadDetail";
import PortalNewThread from "@/pages/portal/PortalNewThread";
import PortalTasks from "@/pages/portal/PortalTasks";
import PortalTaskComplete from "@/pages/portal/PortalTaskComplete";
import PortalProfile from "@/pages/portal/PortalProfile";
import PortalDocuments from "@/pages/portal/PortalDocuments";
import Messages from "@/pages/messages";
import InternalChat from "@/pages/internal-chat";
import ClientRequests from "@/pages/client-requests";
import InternalTasks from "@/pages/internal-tasks";
import InternalTaskDetail from "@/pages/internal-task-detail";
import logoPath from "@assets/full_logo_transparent_600_1761924125378.png";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  // Public routes that should render immediately without auth check
  const publicRoutes = [
    '/login',
    '/portal/login',
    '/portal/verify',
    '/portal/install',
    '/magic-link-verify'
  ];
  
  const isPublicRoute = publicRoutes.some(route => location.startsWith(route));

  // Only show loading screen for protected routes
  if (isLoading && !isPublicRoute) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A7BBF]/10 via-white to-[#76CA23]/10 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <img 
            src={logoPath} 
            alt="Growth Accountants" 
            className="h-20 mx-auto mb-6 animate-pulse"
          />
          <h1 className="text-2xl font-bold text-[#0A7BBF] dark:text-[#76CA23] mb-4">The Link</h1>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0A7BBF] dark:border-[#76CA23] mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Portal routes - separate auth system */}
      <Route path="/portal/install" component={PortalInstall} />
      <Route path="/portal/login" component={PortalLogin} />
      <Route path="/portal/verify" component={PortalVerify} />
      <Route path="/portal/threads/new" component={PortalNewThread} />
      <Route path="/portal/threads/:id" component={PortalThreadDetail} />
      <Route path="/portal/threads" component={PortalThreadList} />
      <Route path="/portal/tasks/:id" component={PortalTaskComplete} />
      <Route path="/portal/tasks" component={PortalTasks} />
      <Route path="/portal/documents" component={PortalDocuments} />
      <Route path="/portal/profile" component={PortalProfile} />
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
      <Route path="/internal-chat" component={InternalChat} />
      <Route path="/client-requests" component={ClientRequests} />
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
      <Route path="/settings/project-types" component={ProjectTypes} />
      <Route path="/settings/project-types/:id" component={ProjectTypeDetail} />
      <Route path="/users" component={Users} />
      <Route path="/services" component={Services} />
      <Route path="/scheduled-services" component={ScheduledServices} />
      <Route path="/ch-changes" component={ChChanges} />
      <Route path="/companies" component={Companies} />
      <Route path="/tags" component={Tags} />
      <Route path="/task-template-categories" component={TaskTemplateCategories} />
      <Route path="/task-templates/:templateId/sections/:sectionId/questions" component={TaskTemplateSectionQuestions} />
      <Route path="/task-templates/:id/edit" component={TaskTemplateEdit} />
      <Route path="/task-templates" component={TaskTemplates} />
      <Route path="/custom-requests/:id/edit" component={CustomRequestEdit} />
      <Route path="/task-submissions/:id" component={TaskSubmissionDetail} />
      <Route path="/task-submissions" component={TaskSubmissions} />
      <Route path="/task-instances/:id" component={TaskInstanceDetail} />
      <Route path="/internal-tasks/:id" component={InternalTaskDetail} />
      <Route path="/internal-tasks" component={InternalTasks} />
      <Route path="/upload" component={Upload} />
      <Route path="/admin" component={Admin} />
      <Route path="/admin/task-types" component={AdminTaskTypes} />
      <Route path="/admin/import" component={DataImport} />
      <Route path="/admin/push-templates" component={PushNotificationTemplates} />
      <Route path="/push-notification-templates" component={PushNotificationTemplates} />
      <Route path="/data-import" component={DataImport} />
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
  const { isAuthenticated: isPortalAuthenticated } = usePortalAuth();

  return (
    <>
      <Toaster />
      <Router />
      <PWAUpdatePrompt />
      {isAuthenticated && <PushNotificationPrompt />}
      {isAuthenticated && <FirstLoginPasswordDialog />}
      {isPortalAuthenticated && <PortalPushNotificationPrompt />}
    </>
  );
}

export default App;
