import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertUserSchema, updateUserNotificationPreferencesSchema } from "@shared/schema";

// Components
import TopNavigation from "@/components/top-navigation";
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
import { User, Bell, Save, Eye, EyeOff } from "lucide-react";

// Zod schemas
const profileUpdateSchema = insertUserSchema.pick({
  firstName: true,
  lastName: true,
}).extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
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
type NotificationPreferences = z.infer<typeof updateUserNotificationPreferencesSchema>;

export default function Profile() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description: error.message || "Failed to update notification preferences",
        variant: "destructive",
      });
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
    }
  }, [user?.firstName, user?.lastName, user?.id]);

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
      <div className="flex-1">
        <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8" data-testid="heading-user-profile">Profile</h1>
        
        {/* Profile Header */}
        <Card className="mb-8">
          <CardHeader className="pb-6">
            <CardTitle className="flex items-center space-x-4">
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
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Profile Tabs */}
        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="account" data-testid="tab-account" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Account
            </TabsTrigger>
            <TabsTrigger value="notifications" data-testid="tab-notifications" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notifications
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

            {/* Password Change - Only show if user has a password hash (not magic-link-only) */}
            {user.passwordHash && (
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

                    {/* Scheduling Summary Notification */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label 
                          htmlFor="notify-scheduling-summary" 
                          className="text-base font-medium"
                          data-testid="label-notify-scheduling-summary"
                        >
                          Nightly Scheduling Summary
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Receive daily email summaries of automated project scheduling results
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
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
    </div>
  );
}