import { Switch, Route, Redirect, useLocation } from "wouter";
import { lazy, Suspense } from "react";
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
import logoPath from "@assets/full_logo_transparent_600_1761924125378.png";

const NotFound = lazy(() => import("@/pages/not-found"));
const Landing = lazy(() => import("@/pages/landing"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Settings = lazy(() => import("@/pages/settings"));
const ProjectTypes = lazy(() => import("@/pages/project-types"));
const ProjectTypeDetail = lazy(() => import("@/pages/project-type-detail"));
const NotificationEditPage = lazy(() => import("@/pages/notification-edit"));
const Users = lazy(() => import("@/pages/users"));
const Upload = lazy(() => import("@/pages/upload"));
const Projects = lazy(() => import("@/pages/projects"));
const ProjectDetail = lazy(() => import("@/pages/project-detail"));
const Profile = lazy(() => import("@/pages/profile"));
const MagicLinkVerify = lazy(() => import("@/pages/magic-link-verify"));
const Clients = lazy(() => import("@/pages/clients"));
const ClientDetail = lazy(() => import("@/pages/client-detail"));
const ClientServiceDetail = lazy(() => import("@/pages/client-service-detail"));
const People = lazy(() => import("@/pages/people"));
const PersonDetail = lazy(() => import("@/pages/person-detail"));
const Services = lazy(() => import("@/pages/services"));
const ScheduledServices = lazy(() => import("@/pages/scheduled-services"));
const ChChanges = lazy(() => import("@/pages/ch-changes"));
const Companies = lazy(() => import("@/pages/companies"));
const Tags = lazy(() => import("@/pages/tags"));
const RequestTemplateCategories = lazy(() => import("@/pages/request-template-categories"));
const RequestTemplates = lazy(() => import("@/pages/request-templates"));
const RequestTemplateEdit = lazy(() => import("@/pages/request-template-edit"));
const RequestTemplateSectionQuestions = lazy(() => import("@/pages/request-template-section-questions"));
const CustomRequestEdit = lazy(() => import("@/pages/custom-request-edit"));
const TaskSubmissions = lazy(() => import("@/pages/task-submissions"));
const TaskSubmissionDetail = lazy(() => import("@/pages/task-submission-detail"));
const TaskInstanceDetail = lazy(() => import("@/pages/task-instance-detail"));
const Admin = lazy(() => import("@/pages/admin"));
const AdminTaskTypes = lazy(() => import("@/pages/admin-task-types"));
const DataImport = lazy(() => import("@/pages/data-import"));
const ExcelImport = lazy(() => import("@/pages/excel-import"));
const PushDiagnostics = lazy(() => import("@/pages/push-diagnostics"));
const PushNotificationTemplates = lazy(() => import("@/pages/push-notification-templates"));
const ScheduledNotifications = lazy(() => import("@/pages/scheduled-notifications"));
const ActivityLogs = lazy(() => import("@/pages/activity-logs"));
const UserActivityTracking = lazy(() => import("@/pages/user-activity-tracking"));
const CompanySettingsPage = lazy(() => import("@/pages/company-settings"));
const PortalLogin = lazy(() => import("@/pages/portal/PortalLogin"));
const PortalVerify = lazy(() => import("@/pages/portal/PortalVerify"));
const PortalInstall = lazy(() => import("@/pages/portal/PortalInstall"));
const PortalThreadList = lazy(() => import("@/pages/portal/PortalThreadList"));
const PortalThreadDetail = lazy(() => import("@/pages/portal/PortalThreadDetail"));
const PortalNewThread = lazy(() => import("@/pages/portal/PortalNewThread"));
const PortalTasks = lazy(() => import("@/pages/portal/PortalTasks"));
const PortalTaskComplete = lazy(() => import("@/pages/portal/PortalTaskComplete"));
const PortalProfile = lazy(() => import("@/pages/portal/PortalProfile"));
const PortalDocuments = lazy(() => import("@/pages/portal/PortalDocuments"));
const Messages = lazy(() => import("@/pages/messages"));
const InternalChat = lazy(() => import("@/pages/internal-chat"));
const ClientRequests = lazy(() => import("@/pages/client-requests"));
const InternalTasks = lazy(() => import("@/pages/internal-tasks"));
const InternalTaskDetail = lazy(() => import("@/pages/internal-task-detail"));
const SignPage = lazy(() => import("@/pages/sign"));
const SignatureRequestsPage = lazy(() => import("@/pages/signature-requests"));
const SignatureRequestBuilder = lazy(() => import("@/pages/signature-request-builder"));

function PageLoader() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A7BBF]/10 via-white to-[#76CA23]/10 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
      <div className="text-center">
        <img 
          src={logoPath} 
          alt="Growth Accountants" 
          className="h-16 mx-auto mb-4 animate-pulse"
        />
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A7BBF] dark:border-[#76CA23] mx-auto"></div>
      </div>
    </div>
  );
}

function PortalPageLoader() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A7BBF]/5 via-white to-[#76CA23]/5 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A7BBF] mx-auto mb-2"></div>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const isPortalRoute = location.startsWith('/portal');

  if (isLoading) {
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

  const LoaderComponent = isPortalRoute ? PortalPageLoader : PageLoader;

  return (
    <Suspense fallback={<LoaderComponent />}>
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
        <Route path="/login">{() => <Landing />}</Route>
        <Route path="/sign" component={SignPage} />
        
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
        <Route path="/clients/:clientId/signature-requests/new" component={SignatureRequestBuilder} />
        <Route path="/client-service/:id" component={ClientServiceDetail} />
        <Route path="/signature-requests" component={SignatureRequestsPage} />
        {/* Redirect /people to new Clients page with People tab */}
        <Route path="/people">
          <Redirect to="/companies" />
        </Route>
        <Route path="/person/:id" component={PersonDetail} />
        <Route path="/profile" component={Profile} />
        <Route path="/settings" component={Settings} />
        <Route path="/project-types" component={ProjectTypes} />
        <Route path="/settings/project-types" component={ProjectTypes} />
        <Route path="/settings/project-types/:projectTypeId/notifications/:notificationId/edit" component={NotificationEditPage} />
        <Route path="/settings/project-types/:id" component={ProjectTypeDetail} />
        <Route path="/users" component={Users} />
        <Route path="/services" component={Services} />
        <Route path="/scheduled-services" component={ScheduledServices} />
        <Route path="/ch-changes" component={ChChanges} />
        <Route path="/companies" component={Companies} />
        <Route path="/tags" component={Tags} />
        <Route path="/request-template-categories" component={RequestTemplateCategories} />
        <Route path="/request-templates/:templateId/sections/:sectionId/questions" component={RequestTemplateSectionQuestions} />
        <Route path="/request-templates/:id/edit" component={RequestTemplateEdit} />
        <Route path="/request-templates" component={RequestTemplates} />
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
        <Route path="/excel-import" component={ExcelImport} />
        <Route path="/push-diagnostics" component={PushDiagnostics} />
        <Route path="/admin/scheduled-notifications" component={ScheduledNotifications} />
        <Route path="/scheduled-notifications" component={ScheduledNotifications} />
        <Route path="/super-admin/activity-logs" component={ActivityLogs} />
        <Route path="/super-admin/user-activity-tracking" component={UserActivityTracking} />
        <Route path="/company-settings" component={CompanySettingsPage} />
        
        {/* Catch-all NotFound route */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
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
