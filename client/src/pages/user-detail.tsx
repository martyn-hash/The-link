import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import TopNavigation from "@/components/top-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import {
  ArrowLeft,
  User as UserIcon,
  Shield,
  Key,
  History,
  Mail,
  Calendar,
  Monitor,
  Smartphone,
  Globe,
  Clock,
  CheckCircle2,
  XCircle,
  Save,
  AlertTriangle,
  Inbox,
  Plus,
  Trash2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { User, UserSession, Inbox as InboxType, UserInboxAccess } from "@shared/schema";

const passwordFormSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordFormSchema>;

interface UserWithSessions extends User {
  sessions?: UserSession[];
}

export default function UserDetailPage() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [match, params] = useRoute("/users/:id");
  const userId = params?.id;

  const [permissions, setPermissions] = useState({
    isAdmin: false,
    canSeeAdminMenu: false,
    superAdmin: false,
    canMakeProjectsInactive: false,
    canMakeServicesInactive: false,
    canBenchProjects: false,
    accessEmail: false,
    accessCalendar: false,
  });

  const { data: targetUser, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/users", userId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: userSessions, isLoading: sessionsLoading } = useQuery<UserSession[]>({
    queryKey: ["/api/super-admin/activity-logs", { userId }],
    enabled: !!userId && !!currentUser?.superAdmin,
  });

  // Inbox access queries
  const { data: userInboxAccess, isLoading: inboxAccessLoading } = useQuery<(UserInboxAccess & { inbox: InboxType })[]>({
    queryKey: ["/api/users", userId, "inbox-access"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/inbox-access`);
      if (!res.ok) throw new Error("Failed to fetch inbox access");
      return res.json();
    },
    enabled: !!userId && !!currentUser?.superAdmin,
  });

  const { data: allInboxes, isLoading: allInboxesLoading } = useQuery<InboxType[]>({
    queryKey: ["/api/inboxes"],
    enabled: !!currentUser?.superAdmin,
  });

  const [selectedInboxId, setSelectedInboxId] = useState<string>("");
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<string>("read");

  useEffect(() => {
    if (targetUser) {
      setPermissions({
        isAdmin: targetUser.isAdmin || false,
        canSeeAdminMenu: targetUser.canSeeAdminMenu || false,
        superAdmin: targetUser.superAdmin || false,
        canMakeProjectsInactive: targetUser.canMakeProjectsInactive || false,
        canMakeServicesInactive: targetUser.canMakeServicesInactive || false,
        canBenchProjects: targetUser.canBenchProjects || false,
        accessEmail: targetUser.accessEmail || false,
        accessCalendar: targetUser.accessCalendar || false,
      });
    }
  }, [targetUser]);

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async (data: Partial<User>) => {
      return await apiRequest("PATCH", `/api/users/${userId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User permissions updated successfully",
      });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (data: { password: string }) => {
      return await apiRequest("PATCH", `/api/users/${userId}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password updated successfully",
      });
      passwordForm.reset();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const grantInboxAccessMutation = useMutation({
    mutationFn: async (data: { inboxId: string; accessLevel: string }) => {
      return await apiRequest("POST", `/api/users/${userId}/inbox-access`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "inbox-access"] });
      toast({
        title: "Success",
        description: "Inbox access granted successfully",
      });
      setSelectedInboxId("");
      setSelectedAccessLevel("read");
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const revokeInboxAccessMutation = useMutation({
    mutationFn: async (inboxId: string) => {
      return await apiRequest("DELETE", `/api/users/${userId}/inbox-access/${inboxId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "inbox-access"] });
      toast({
        title: "Success",
        description: "Inbox access revoked successfully",
      });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const handlePermissionChange = (key: keyof typeof permissions, value: boolean) => {
    const newPermissions = { ...permissions, [key]: value };
    setPermissions(newPermissions);
    updatePermissionsMutation.mutate({ [key]: value });
  };

  const handlePasswordSubmit = (data: PasswordFormData) => {
    updatePasswordMutation.mutate({ password: data.password });
  };

  const getRoleDisplay = (user: User) => {
    if (user.superAdmin) {
      return { label: "Super Admin", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" };
    }
    if (user.isAdmin) {
      return { label: "Admin", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" };
    }
    if (user.canSeeAdminMenu) {
      return { label: "Manager", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" };
    }
    return { label: "User", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200" };
  };

  const getDeviceIcon = (device: string | null) => {
    if (!device) return <Monitor className="w-4 h-4" />;
    const lower = device.toLowerCase();
    if (lower.includes("mobile") || lower.includes("phone")) {
      return <Smartphone className="w-4 h-4" />;
    }
    return <Monitor className="w-4 h-4" />;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-muted-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  if (userLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopNavigation user={currentUser} />
        <main className="flex-1 p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (!targetUser) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopNavigation user={currentUser} />
        <main className="flex-1 p-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-2xl font-bold text-muted-foreground mb-2">User Not Found</h1>
            <p className="text-muted-foreground mb-4">The user you're looking for doesn't exist.</p>
            <Link href="/users">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Users
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const roleDisplay = getRoleDisplay(targetUser);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={currentUser} />
      
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/users">
              <Button variant="ghost" size="sm" data-testid="button-back-to-users">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Users
              </Button>
            </Link>
          </div>

          <Card data-testid="card-user-info">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    {targetUser.profileImageUrl ? (
                      <img
                        src={targetUser.profileImageUrl}
                        alt={`${targetUser.firstName} ${targetUser.lastName}`}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <UserIcon className="w-8 h-8 text-primary" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-2xl" data-testid="text-user-name">
                      {targetUser.firstName} {targetUser.lastName}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Mail className="w-4 h-4" />
                      {targetUser.email}
                    </CardDescription>
                  </div>
                </div>
                <Badge className={roleDisplay.color} data-testid="badge-user-role">
                  {roleDisplay.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <span className="ml-2">
                    {targetUser.createdAt
                      ? format(new Date(targetUser.createdAt), "PPP")
                      : "Unknown"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Last Login:</span>
                  <span className="ml-2">
                    {targetUser.lastLoginAt
                      ? formatDistanceToNow(new Date(targetUser.lastLoginAt), { addSuffix: true })
                      : "Never"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-permissions">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Permissions
              </CardTitle>
              <CardDescription>
                Manage user access levels and special permissions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Role Permissions
                </h4>
                
                <div className="flex items-center justify-between py-2 border-b">
                  <div className="space-y-0.5">
                    <Label htmlFor="isAdmin">Admin</Label>
                    <p className="text-sm text-muted-foreground">
                      Full administrative access to the system
                    </p>
                  </div>
                  <Switch
                    id="isAdmin"
                    checked={permissions.isAdmin}
                    onCheckedChange={(checked) => handlePermissionChange("isAdmin", checked)}
                    disabled={updatePermissionsMutation.isPending}
                    data-testid="switch-is-admin"
                  />
                </div>

                <div className="flex items-center justify-between py-2 border-b">
                  <div className="space-y-0.5">
                    <Label htmlFor="canSeeAdminMenu">Can See Admin Menu</Label>
                    <p className="text-sm text-muted-foreground">
                      Access to admin menu options without full admin rights
                    </p>
                  </div>
                  <Switch
                    id="canSeeAdminMenu"
                    checked={permissions.canSeeAdminMenu}
                    onCheckedChange={(checked) => handlePermissionChange("canSeeAdminMenu", checked)}
                    disabled={updatePermissionsMutation.isPending}
                    data-testid="switch-can-see-admin-menu"
                  />
                </div>

                {currentUser?.superAdmin && (
                  <div className="flex items-center justify-between py-2 border-b">
                    <div className="space-y-0.5">
                      <Label htmlFor="superAdmin" className="flex items-center gap-2">
                        Super Admin
                        <Badge variant="outline" className="text-xs">Super Admin Only</Badge>
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Highest level of access - can manage all system settings
                      </p>
                    </div>
                    <Switch
                      id="superAdmin"
                      checked={permissions.superAdmin}
                      onCheckedChange={(checked) => handlePermissionChange("superAdmin", checked)}
                      disabled={updatePermissionsMutation.isPending}
                      data-testid="switch-super-admin"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Special Permissions
                </h4>

                <div className="flex items-center justify-between py-2 border-b">
                  <div className="space-y-0.5">
                    <Label htmlFor="canMakeProjectsInactive">Can Make Projects Inactive</Label>
                    <p className="text-sm text-muted-foreground">
                      Ability to mark projects as inactive
                    </p>
                  </div>
                  <Switch
                    id="canMakeProjectsInactive"
                    checked={permissions.canMakeProjectsInactive}
                    onCheckedChange={(checked) => handlePermissionChange("canMakeProjectsInactive", checked)}
                    disabled={updatePermissionsMutation.isPending}
                    data-testid="switch-can-make-projects-inactive"
                  />
                </div>

                <div className="flex items-center justify-between py-2 border-b">
                  <div className="space-y-0.5">
                    <Label htmlFor="canMakeServicesInactive">Can Make Services Inactive</Label>
                    <p className="text-sm text-muted-foreground">
                      Ability to mark services as inactive
                    </p>
                  </div>
                  <Switch
                    id="canMakeServicesInactive"
                    checked={permissions.canMakeServicesInactive}
                    onCheckedChange={(checked) => handlePermissionChange("canMakeServicesInactive", checked)}
                    disabled={updatePermissionsMutation.isPending}
                    data-testid="switch-can-make-services-inactive"
                  />
                </div>

                <div className="flex items-center justify-between py-2 border-b">
                  <div className="space-y-0.5">
                    <Label htmlFor="canBenchProjects">Can Bench Projects</Label>
                    <p className="text-sm text-muted-foreground">
                      Ability to move projects to and from the bench
                    </p>
                  </div>
                  <Switch
                    id="canBenchProjects"
                    checked={permissions.canBenchProjects}
                    onCheckedChange={(checked) => handlePermissionChange("canBenchProjects", checked)}
                    disabled={updatePermissionsMutation.isPending}
                    data-testid="switch-can-bench-projects"
                  />
                </div>
              </div>

              {currentUser?.superAdmin && (
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                    Integration Access
                  </h4>

                  <div className="flex items-center justify-between py-2 border-b">
                    <div className="space-y-0.5">
                      <Label htmlFor="accessEmail" className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email Access
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Access to email integration features
                      </p>
                    </div>
                    <Switch
                      id="accessEmail"
                      checked={permissions.accessEmail}
                      onCheckedChange={(checked) => handlePermissionChange("accessEmail", checked)}
                      disabled={updatePermissionsMutation.isPending}
                      data-testid="switch-access-email"
                    />
                  </div>

                  <div className="flex items-center justify-between py-2 border-b">
                    <div className="space-y-0.5">
                      <Label htmlFor="accessCalendar" className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Calendar Access
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Access to calendar integration features
                      </p>
                    </div>
                    <Switch
                      id="accessCalendar"
                      checked={permissions.accessCalendar}
                      onCheckedChange={(checked) => handlePermissionChange("accessCalendar", checked)}
                      disabled={updatePermissionsMutation.isPending}
                      data-testid="switch-access-calendar"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-password">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Change Password
              </CardTitle>
              <CardDescription>
                Set a new password for this user
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                  <FormField
                    control={passwordForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Enter new password"
                            {...field}
                            data-testid="input-new-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Confirm new password"
                            {...field}
                            data-testid="input-confirm-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    disabled={updatePasswordMutation.isPending}
                    data-testid="button-change-password"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {updatePasswordMutation.isPending ? "Saving..." : "Change Password"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {currentUser?.superAdmin && (
            <Card data-testid="card-inbox-access">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Inbox className="w-5 h-5" />
                  Inbox Access
                </CardTitle>
                <CardDescription>
                  Manage which email inboxes this user can access
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Select value={selectedInboxId} onValueChange={setSelectedInboxId}>
                    <SelectTrigger className="flex-1" data-testid="select-inbox">
                      <SelectValue placeholder="Select an inbox..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allInboxesLoading ? (
                        <SelectItem value="_loading" disabled>Loading inboxes...</SelectItem>
                      ) : allInboxes && allInboxes.length > 0 ? (
                        allInboxes
                          .filter(inbox => !userInboxAccess?.some(access => access.inboxId === inbox.id))
                          .map(inbox => (
                            <SelectItem key={inbox.id} value={inbox.id}>
                              <span className="flex items-center gap-2">
                                {inbox.displayName || inbox.emailAddress}
                                <span className="text-muted-foreground text-xs">
                                  ({inbox.inboxType})
                                </span>
                              </span>
                            </SelectItem>
                          ))
                      ) : (
                        <SelectItem value="_none" disabled>No inboxes available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  
                  <Select value={selectedAccessLevel} onValueChange={setSelectedAccessLevel}>
                    <SelectTrigger className="w-[140px]" data-testid="select-access-level">
                      <SelectValue placeholder="Access level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read">Read</SelectItem>
                      <SelectItem value="write">Write</SelectItem>
                      <SelectItem value="full">Full</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button
                    onClick={() => {
                      if (selectedInboxId) {
                        grantInboxAccessMutation.mutate({
                          inboxId: selectedInboxId,
                          accessLevel: selectedAccessLevel,
                        });
                      }
                    }}
                    disabled={!selectedInboxId || grantInboxAccessMutation.isPending}
                    data-testid="button-grant-access"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {grantInboxAccessMutation.isPending ? "Granting..." : "Grant Access"}
                  </Button>
                </div>

                {inboxAccessLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : userInboxAccess && userInboxAccess.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Inbox</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Access Level</TableHead>
                          <TableHead>Granted</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userInboxAccess.map((access) => {
                          const isOwnInbox = access.inbox.linkedUserId === userId;
                          return (
                            <TableRow key={access.id} data-testid={`row-inbox-${access.id}`}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Mail className="w-4 h-4 text-muted-foreground" />
                                  <div>
                                    <div className="font-medium">
                                      {access.inbox.displayName || access.inbox.emailAddress}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {access.inbox.emailAddress}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={access.inbox.inboxType === 'user' ? 'default' : 'secondary'}>
                                  {access.inbox.inboxType}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{access.accessLevel}</Badge>
                              </TableCell>
                              <TableCell>
                                {access.grantedAt 
                                  ? formatDistanceToNow(new Date(access.grantedAt), { addSuffix: true })
                                  : "Unknown"
                                }
                              </TableCell>
                              <TableCell>
                                {isOwnInbox ? (
                                  <span className="text-xs text-muted-foreground">Own inbox</span>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => revokeInboxAccessMutation.mutate(access.inboxId)}
                                    disabled={revokeInboxAccessMutation.isPending}
                                    data-testid={`button-revoke-${access.id}`}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Inbox className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No inbox access configured for this user</p>
                    <p className="text-sm mt-2">Grant access to inboxes using the form above</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {currentUser?.superAdmin && (
            <Card data-testid="card-login-history">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Login History
                </CardTitle>
                <CardDescription>
                  Recent login sessions for this user
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sessionsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : userSessions && userSessions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Login Time</TableHead>
                          <TableHead>Device / Browser</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Duration</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userSessions.slice(0, 20).map((session) => (
                          <TableRow key={session.id} data-testid={`row-session-${session.id}`}>
                            <TableCell>
                              {session.isActive ? (
                                <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Ended
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <div>
                                  <div className="font-medium">
                                    {format(new Date(session.loginTime), "PPp")}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(session.loginTime), { addSuffix: true })}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getDeviceIcon(session.device)}
                                <div>
                                  <div className="font-medium">{session.browser || "Unknown"}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {session.os || "Unknown OS"} • {session.device || "Unknown Device"}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-muted-foreground" />
                                <div>
                                  <div className="font-medium">
                                    {session.city && session.country
                                      ? `${session.city}, ${session.country}`
                                      : session.country || "Unknown"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {session.ipAddress || "No IP"}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {session.sessionDuration ? (
                                <span>
                                  {session.sessionDuration < 60
                                    ? `${session.sessionDuration}m`
                                    : `${Math.floor(session.sessionDuration / 60)}h ${session.sessionDuration % 60}m`}
                                </span>
                              ) : session.isActive ? (
                                <span className="text-muted-foreground">Ongoing</span>
                              ) : (
                                <span className="text-muted-foreground">N/A</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No login history available for this user</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
