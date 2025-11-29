import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertUserSchema, updateUserNotificationPreferencesSchema } from "@shared/schema";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { showFriendlyError } from "@/lib/friendlyErrors";

// Components
import TopNavigation from "@/components/top-navigation";
import BottomNav from "@/components/bottom-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Icons
import { User, Bell, Save, Eye, EyeOff, Settings, Mail, CheckCircle, AlertCircle, ExternalLink, LogOut, Edit3, Phone } from "lucide-react";
import { TiptapEditor } from '@/components/TiptapEditor';

// Zod schemas
const profileUpdateSchema = insertUserSchema.pick({
  firstName: true,
  lastName: true,
}).extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

const emailSignatureUpdateSchema = z.object({
  emailSignature: z.string().optional(),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;
type PasswordChangeData = z.infer<typeof passwordChangeSchema>;
type EmailSignatureUpdateData = z.infer<typeof emailSignatureUpdateSchema>;
type NotificationPreferences = z.infer<typeof updateUserNotificationPreferencesSchema>;

// Push Notifications Management Card
function PushNotificationsCard() {
  const { isSupported, isSubscribed, permission, isLoading, subscribe, unsubscribe } = usePushNotifications();
  const { toast } = useToast();

  const handleSubscribe = async () => {
    const success = await subscribe();
    if (success) {
      toast({
        title: 'Push notifications enabled',
        description: 'You will receive push notifications for important updates.',
      });
    } else {
      showFriendlyError({ error: 'Failed to enable push notifications. Please check your browser permissions.' });
    }
  };

  const handleUnsubscribe = async () => {
    const success = await unsubscribe();
    if (success) {
      toast({
        title: 'Push notifications disabled',
        description: 'You will no longer receive push notifications.',
      });
    } else {
      showFriendlyError({ error: 'Failed to disable push notifications. Please try again later.' });
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Push Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 bg-muted rounded-lg" data-testid="alert-push-not-supported">
            <AlertCircle className="w-5 h-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Push notifications are not supported in your browser.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Push Notifications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Enable push notifications to receive real-time alerts about project updates, even when you're not using the app.
        </p>

        <div className="flex items-center justify-between p-4 border rounded-lg" data-testid="container-push-status">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isSubscribed ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-800'
            }`}>
              <Bell className={`w-5 h-5 ${
                isSubscribed ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
              }`} />
            </div>
            <div>
              <p className="font-medium" data-testid="text-push-status">
                {isSubscribed ? 'Enabled' : permission === 'denied' ? 'Blocked' : 'Disabled'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isSubscribed 
                  ? 'You are receiving push notifications' 
                  : permission === 'denied'
                  ? 'Please enable notifications in your browser settings'
                  : 'Enable notifications to stay updated'}
              </p>
            </div>
          </div>

          {permission !== 'denied' && (
            <Button
              onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
              disabled={isLoading}
              variant={isSubscribed ? 'outline' : 'default'}
              data-testid={isSubscribed ? 'button-unsubscribe-push' : 'button-subscribe-push'}
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              ) : isSubscribed ? (
                'Disable'
              ) : (
                'Enable'
              )}
            </Button>
          )}
        </div>

        {permission === 'denied' && (
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg" data-testid="alert-push-blocked">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900 dark:text-red-100">
                Notifications Blocked
              </p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                You have blocked notifications for this site. To enable them, please update your browser settings.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Profile() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailSignature, setEmailSignature] = useState('');
  
  // Get initial tab from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab') || 'account';

  // Profile form
  const profileForm = useForm<ProfileUpdateData>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
    },
  });

  // Password form
  const passwordForm = useForm<PasswordChangeData>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Fetch notification preferences
  const { data: notificationPreferences, isLoading: notificationsLoading } = useQuery<NotificationPreferences & {id: string, userId: string}>({
    queryKey: ["/api/users/notifications"],
    enabled: !!user,
  });

  // Fetch Outlook connection status
  const { data: outlookStatus, isLoading: outlookStatusLoading, refetch: refetchOutlookStatus } = useQuery<{
    connected: boolean;
    email?: string;
    displayName?: string;
    needsReauth?: boolean;
  }>({
    queryKey: ["/api/oauth/outlook/status"],
    enabled: !!user,
  });

  // Fetch RingCentral connection status
  const { data: ringcentralStatus, isLoading: ringcentralStatusLoading, refetch: refetchRingCentralStatus } = useQuery<{
    connected: boolean;
    hasTokens: boolean;
  }>({
    queryKey: ["/api/ringcentral/status"],
    enabled: !!user,
  });

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileUpdateData) => {
      return await apiRequest("PUT", "/api/users/profile", data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Profile updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  // Password change mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: PasswordChangeData) => {
      return await apiRequest("PUT", "/api/users/password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Password updated successfully" });
      passwordForm.reset();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  // Notification preferences mutation
  const updateNotificationsMutation = useMutation({
    mutationFn: async (data: Partial<NotificationPreferences>) => {
      return await apiRequest("PUT", "/api/users/notifications", data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Notification preferences updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/users/notifications"] });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  // Email signature update mutation
  const updateEmailSignatureMutation = useMutation({
    mutationFn: async (data: EmailSignatureUpdateData) => {
      return await apiRequest("PUT", "/api/users/profile", data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Email signature updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  // Outlook disconnect mutation
  const disconnectOutlookMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", "/api/oauth/outlook/disconnect");
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Outlook account disconnected successfully" });
      refetchOutlookStatus();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  // RingCentral disconnect mutation
  const disconnectRingCentralMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", "/api/oauth/ringcentral/disconnect");
    },
    onSuccess: () => {
      toast({ title: "Success", description: "RingCentral account disconnected successfully" });
      refetchRingCentralStatus();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  // Handle profile form submission
  const onProfileSubmit = (data: ProfileUpdateData) => {
    updateProfileMutation.mutate(data);
  };

  // Handle password form submission
  const onPasswordSubmit = (data: PasswordChangeData) => {
    changePasswordMutation.mutate(data);
  };

  // Handle notification toggle
  const handleNotificationToggle = (field: keyof NotificationPreferences, value: boolean) => {
    updateNotificationsMutation.mutate({ [field]: value });
  };

  // Handle email signature save
  const handleEmailSignatureSave = () => {
    updateEmailSignatureMutation.mutate({ emailSignature });
  };

  // Handle Outlook connection
  const handleOutlookConnect = async () => {
    try {
      const response = await fetch('/api/oauth/outlook/auth-url');
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        showFriendlyError({ error: "Failed to generate authentication URL" });
      }
    } catch (error) {
      showFriendlyError({ error });
    }
  };

  // Handle Outlook disconnect
  const handleOutlookDisconnect = () => {
    disconnectOutlookMutation.mutate();
  };

  // Handle RingCentral connection
  const handleRingCentralConnect = async () => {
    try {
      const response = await fetch('/api/oauth/ringcentral/auth-url');
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        showFriendlyError({ error: "Failed to generate authentication URL" });
      }
    } catch (error) {
      showFriendlyError({ error });
    }
  };

  // Handle RingCentral disconnect
  const handleRingCentralDisconnect = () => {
    disconnectRingCentralMutation.mutate();
  };

  // Handle logout
  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
  };

  // Utility functions
  const getUserInitials = () => {
    if (!user) return "U";
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || user.email?.charAt(0).toUpperCase() || "U";
  };

  const getRoleLabel = () => {
    if (!user) return "Loading...";
    if (user.isAdmin) return "Admin";
    if (user.canSeeAdminMenu) return "Manager";
    return "User";
  };

  // Update form defaults when user data changes
  useEffect(() => {
    if (user) {
      profileForm.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
      }, {
        keepDirty: false
      });
      
      // Initialize email signature from user data
      setEmailSignature(user.emailSignature || "");
    }
  }, [user?.firstName, user?.lastName, user?.id, user?.emailSignature]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopNavigation user={user || undefined} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopNavigation user={user || undefined} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Please log in to access your profile.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
      
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="page-container py-6 md:py-8">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight" data-testid="heading-user-profile">Profile</h1>
        </div>
      </div>

      <div className="flex-1">
        <div className="page-container py-6 md:py-8 space-y-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Profile Header */}
        <Card className="mb-8">
          <CardHeader className="pb-6">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={user.profileImageUrl || ""} alt={`${user.firstName || ''} ${user.lastName || ''}`} />
                  <AvatarFallback className="bg-accent text-accent-foreground text-lg">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-semibold" data-testid="text-profile-name">
                    {user.firstName && user.lastName 
                      ? `${user.firstName} ${user.lastName}` 
                      : user.email || 'User'}
                  </h2>
                  <Badge variant="secondary" data-testid="badge-user-role">
                    {getRoleLabel()}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-1" data-testid="text-user-email">
                    {user.email}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                onClick={handleLogout}
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Profile Tabs */}
        <Tabs defaultValue={initialTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="account" data-testid="tab-account" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Account
            </TabsTrigger>
            <TabsTrigger value="notifications" data-testid="tab-notifications" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="integrations" data-testid="tab-integrations" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Integrations
            </TabsTrigger>
          </TabsList>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-6">
            {/* Profile Information */}
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={profileForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                data-testid="input-first-name"
                                placeholder="Enter your first name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={profileForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                data-testid="input-last-name"
                                placeholder="Enter your last name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button 
                      type="submit" 
                      data-testid="button-save-profile"
                      disabled={updateProfileMutation.isPending || !profileForm.formState.isDirty}
                      className="flex items-center gap-2"
                    >
                      {updateProfileMutation.isPending ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Save Changes
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Password Change - Only show if user has password-based authentication */}
            {user.hasPassword && (
              <Card>
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                </CardHeader>
                <CardContent>
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                {...field} 
                                type={showCurrentPassword ? "text" : "password"}
                                data-testid="input-current-password"
                                placeholder="Enter your current password"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-2 top-0 h-full"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                data-testid="button-toggle-current-password"
                              >
                                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                {...field} 
                                type={showNewPassword ? "text" : "password"}
                                data-testid="input-new-password"
                                placeholder="Enter your new password"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-2 top-0 h-full"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                data-testid="button-toggle-new-password"
                              >
                                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </Button>
                            </div>
                          </FormControl>
                          <FormDescription>
                            Password must be at least 6 characters long
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm New Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                {...field} 
                                type={showConfirmPassword ? "text" : "password"}
                                data-testid="input-confirm-password"
                                placeholder="Confirm your new password"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-2 top-0 h-full"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                data-testid="button-toggle-confirm-password"
                              >
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      data-testid="button-change-password"
                      disabled={changePasswordMutation.isPending || !passwordForm.formState.isDirty}
                      className="flex items-center gap-2"
                    >
                      {changePasswordMutation.isPending ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Change Password
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
            )}
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {notificationsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : (
                  <>
                    {/* Stage Changes Notification */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label 
                          htmlFor="notify-stage-changes" 
                          className="text-base font-medium"
                          data-testid="label-notify-stage-changes"
                        >
                          Stage Responsibility Notifications
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Notify when a project moves to a stage that I am responsible for
                        </p>
                      </div>
                      <Switch
                        id="notify-stage-changes"
                        data-testid="switch-notify-stage-changes"
                        checked={notificationPreferences?.notifyStageChanges ?? true}
                        onCheckedChange={(checked) => handleNotificationToggle('notifyStageChanges', checked)}
                        disabled={updateNotificationsMutation.isPending}
                      />
                    </div>

                    <Separator />

                    {/* New Projects Notification */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label 
                          htmlFor="notify-new-projects" 
                          className="text-base font-medium"
                          data-testid="label-notify-new-projects"
                        >
                          New Project Assignments
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Notify when new projects are assigned to me
                        </p>
                      </div>
                      <Switch
                        id="notify-new-projects"
                        data-testid="switch-notify-new-projects"
                        checked={notificationPreferences?.notifyNewProjects ?? true}
                        onCheckedChange={(checked) => handleNotificationToggle('notifyNewProjects', checked)}
                        disabled={updateNotificationsMutation.isPending}
                      />
                    </div>

                    <Separator />

                    {/* Scheduling Summary Notification - Admin Only */}
                    {user?.isAdmin && (
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label 
                            htmlFor="notify-scheduling-summary" 
                            className="text-base font-medium"
                            data-testid="label-notify-scheduling-summary"
                          >
                            Nightly Scheduling Summary (Admin Only)
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Receive daily email summaries of automated project scheduling results with operational details
                          </p>
                        </div>
                        <Switch
                          id="notify-scheduling-summary"
                          data-testid="switch-notify-scheduling-summary"
                          checked={notificationPreferences?.notifySchedulingSummary ?? false}
                          onCheckedChange={(checked) => handleNotificationToggle('notifySchedulingSummary', checked)}
                          disabled={updateNotificationsMutation.isPending}
                        />
                      </div>
                    )}

                    {updateNotificationsMutation.isPending && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                        Saving changes...
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Push Notifications Card */}
            <PushNotificationsCard />
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Integrations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Outlook Integration */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                      <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold" data-testid="text-outlook-title">
                        Microsoft Outlook
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Connect your personal Outlook account to send emails from your own mailbox
                      </p>
                      {outlookStatus?.connected && outlookStatus.email && (
                        <p className="text-sm text-green-600 dark:text-green-400 mt-1" data-testid="text-outlook-email">
                          Connected as {outlookStatus.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    {outlookStatusLoading ? (
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    ) : outlookStatus?.connected ? (
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          <span className="text-sm text-green-600 dark:text-green-400" data-testid="status-outlook-connected">
                            Connected
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleOutlookDisconnect}
                          disabled={disconnectOutlookMutation.isPending}
                          data-testid="button-disconnect-outlook"
                        >
                          {disconnectOutlookMutation.isPending ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                          ) : (
                            "Disconnect"
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        {outlookStatus?.needsReauth && (
                          <div className="flex items-center space-x-1">
                            <AlertCircle className="w-5 h-5 text-yellow-500" />
                            <span className="text-sm text-yellow-600 dark:text-yellow-400">
                              Needs reauth
                            </span>
                          </div>
                        )}
                        <Button
                          onClick={handleOutlookConnect}
                          size="sm"
                          data-testid="button-connect-outlook"
                          className="flex items-center gap-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Connect
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* RingCentral Integration */}
            <Card>
              <CardHeader>
                <CardTitle>Phone Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
                      <Phone className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold" data-testid="text-ringcentral-title">
                        RingCentral
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Connect your RingCentral account to make calls with automatic transcription
                      </p>
                      {ringcentralStatus?.connected && (
                        <p className="text-sm text-green-600 dark:text-green-400 mt-1" data-testid="text-ringcentral-connected">
                          Connected and ready to make calls
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    {ringcentralStatusLoading ? (
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    ) : ringcentralStatus?.connected ? (
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          <span className="text-sm text-green-600 dark:text-green-400" data-testid="status-ringcentral-connected">
                            Connected
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRingCentralDisconnect}
                          disabled={disconnectRingCentralMutation.isPending}
                          data-testid="button-disconnect-ringcentral"
                        >
                          {disconnectRingCentralMutation.isPending ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                          ) : (
                            "Disconnect"
                          )}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={handleRingCentralConnect}
                        size="sm"
                        data-testid="button-connect-ringcentral"
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Email Signature */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Edit3 className="h-5 w-5" />
                  Email Signature
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Create an HTML email signature that will be automatically appended to all emails you send from the CRM.
                </p>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Signature Content</Label>
                  <div data-testid="editor-email-signature">
                    <TiptapEditor
                      content={emailSignature}
                      onChange={setEmailSignature}
                      placeholder="Enter your email signature..."
                      editorHeight="200px"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleEmailSignatureSave}
                    disabled={updateEmailSignatureMutation.isPending}
                    className="flex items-center gap-2"
                    data-testid="button-save-email-signature"
                  >
                    {updateEmailSignatureMutation.isPending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Signature
                  </Button>
                  
                  {emailSignature && (
                    <Button
                      variant="outline"
                      onClick={() => setEmailSignature("")}
                      data-testid="button-clear-email-signature"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
    <BottomNav user={user} onSearchClick={() => {}} />
    </div>
  );
}