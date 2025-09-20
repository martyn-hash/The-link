import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Users, Plus, Edit, Trash2, Mail, Calendar, Shield, Settings } from "lucide-react";
import type { User } from "@shared/schema";

const createUserFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["admin", "manager", "client_manager", "bookkeeper"]),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const editUserFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["admin", "manager", "client_manager", "bookkeeper"]),
  password: z.string().min(6, "Password must be at least 6 characters long").optional().or(z.literal("")),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  if (data.password && data.password !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type CreateUserFormData = z.infer<typeof createUserFormSchema>;
type EditUserFormData = z.infer<typeof editUserFormSchema>;
type UserFormData = CreateUserFormData | EditUserFormData;

export default function UserManagement() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fallback user queries and mutations
  const { data: fallbackUser, isLoading: fallbackUserLoading } = useQuery<User>({
    queryKey: ["/api/config/fallback-user"],
    retry: false, // Don't retry on 404 when no fallback user is set
  });

  const [selectedFallbackUserId, setSelectedFallbackUserId] = useState<string>("");

  const form = useForm<UserFormData>({
    resolver: zodResolver(selectedUser ? editUserFormSchema : createUserFormSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      role: "bookkeeper",
      password: "",
      confirmPassword: "",
    },
  });

  // Reset form when user selection changes
  useEffect(() => {
    if (selectedUser) {
      form.reset({
        email: selectedUser.email || "",
        firstName: selectedUser.firstName || "",
        lastName: selectedUser.lastName || "",
        role: selectedUser.role,
        password: "",
        confirmPassword: "",
      });
    } else {
      form.reset({
        email: "",
        firstName: "",
        lastName: "",
        role: "bookkeeper",
        password: "",
        confirmPassword: "",
      });
    }
  }, [selectedUser, form]);

  const createUserMutation = useMutation({
    mutationFn: async (userData: UserFormData) => {
      // Strip confirmPassword before sending to API
      const { confirmPassword, ...dataToSend } = userData;
      return await apiRequest("POST", "/api/users", dataToSend);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User created successfully",
      });
      setShowUserForm(false);
      setSelectedUser(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (userData: UserFormData) => {
      if (!selectedUser) throw new Error("No user selected");
      
      // Strip confirmPassword and empty password before sending to API
      const { confirmPassword, password, ...baseData } = userData;
      const dataToSend = {
        ...baseData,
        ...(password && password.trim() ? { password } : {}) // Only include password if not empty
      };
      
      return await apiRequest("PATCH", `/api/users/${selectedUser.id}`, dataToSend);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User updated successfully",
      });
      setShowUserForm(false);
      setSelectedUser(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const setFallbackUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("POST", "/api/config/fallback-user", { userId });
    },
    onSuccess: (data: User) => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/fallback-user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: `${data.firstName} ${data.lastName} has been set as the fallback user`,
      });
      setSelectedFallbackUserId("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set fallback user",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: UserFormData) => {
    if (selectedUser) {
      updateUserMutation.mutate(data);
    } else {
      createUserMutation.mutate(data);
    }
  };

  const handleNewUser = () => {
    setSelectedUser(null);
    setShowUserForm(true);
    form.reset({
      email: "",
      firstName: "",
      lastName: "",
      role: "bookkeeper",
    });
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setShowUserForm(true);
  };

  const handleDeleteUser = (user: User) => {
    if (confirm(`Are you sure you want to delete ${user.firstName} ${user.lastName}?`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  const handleSetFallbackUser = () => {
    if (!selectedFallbackUserId) {
      toast({
        title: "Error",
        description: "Please select a user to set as fallback",
        variant: "destructive",
      });
      return;
    }

    const selectedUser = users?.find(u => u.id === selectedFallbackUserId);
    if (!selectedUser) {
      toast({
        title: "Error",
        description: "Selected user not found",
        variant: "destructive",
      });
      return;
    }

    setFallbackUserMutation.mutate(selectedFallbackUserId);
  };

  const getRoleColor = (role: string) => {
    const colors = {
      admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      manager: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      client_manager: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      bookkeeper: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    };
    return colors[role as keyof typeof colors] || colors.bookkeeper;
  };

  const getRoleLabel = (role: string) => {
    return role.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase());
  };

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

  if (!isAuthenticated || !user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-muted-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar user={user!} />
      
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-page-title">
                User Management
              </h1>
              <p className="text-muted-foreground mt-2">
                Manage user accounts, roles, and permissions across your organization.
              </p>
            </div>
          </div>

          {/* Fallback User Settings */}
          <Card className="mb-8" data-testid="card-fallback-user-settings">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Fallback User Settings
              </CardTitle>
              <CardDescription>
                Set a fallback user to handle role assignments when no specific user is assigned to a required role.
                This helps reduce 404 rates in role-based assignments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Current Fallback User</label>
                  {fallbackUserLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      Loading...
                    </div>
                  ) : fallbackUser ? (
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg" data-testid="current-fallback-user">
                      <Shield className="w-4 h-4 text-primary" />
                      <div>
                        <div className="font-medium">
                          {fallbackUser.firstName} {fallbackUser.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {fallbackUser.email}
                        </div>
                      </div>
                      <Badge className={getRoleColor(fallbackUser.role)}>
                        {getRoleLabel(fallbackUser.role)}
                      </Badge>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground p-3 bg-muted rounded-lg" data-testid="no-fallback-user">
                      <Settings className="w-4 h-4" />
                      No fallback user configured
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label htmlFor="fallback-user-select" className="text-sm font-medium mb-2 block">
                    Set New Fallback User
                  </label>
                  <Select 
                    value={selectedFallbackUserId} 
                    onValueChange={setSelectedFallbackUserId}
                    data-testid="select-fallback-user"
                  >
                    <SelectTrigger id="fallback-user-select">
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center gap-2">
                            <span>{user.firstName} {user.lastName}</span>
                            <span className="text-sm text-muted-foreground">({user.email})</span>
                            <Badge className={getRoleColor(user.role)} variant="outline">
                              {getRoleLabel(user.role)}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      disabled={!selectedFallbackUserId || setFallbackUserMutation.isPending}
                      data-testid="button-set-fallback-user"
                    >
                      {setFallbackUserMutation.isPending ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <Shield className="w-4 h-4 mr-2" />
                      )}
                      Set Fallback User
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent data-testid="dialog-confirm-fallback-user">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Fallback User Change</AlertDialogTitle>
                      <AlertDialogDescription>
                        {selectedFallbackUserId && users ? (
                          <>
                            Are you sure you want to set <strong>
                              {users.find(u => u.id === selectedFallbackUserId)?.firstName} {users.find(u => u.id === selectedFallbackUserId)?.lastName}
                            </strong> as the fallback user? This user will be assigned to roles when no specific user assignment exists.
                          </>
                        ) : (
                          'Please select a user first.'
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="button-cancel-fallback-user">Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleSetFallbackUser}
                        data-testid="button-confirm-fallback-user"
                      >
                        Set as Fallback User
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-6">
            {/* User List */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Users ({users?.length || 0})</h3>
                <Button
                  onClick={handleNewUser}
                  data-testid="button-new-user"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New User
                </Button>
              </div>

              <div className="flex-1 overflow-auto border rounded-lg">
                {usersLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="w-20">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users?.map((user: User) => (
                        <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span>{user.firstName} {user.lastName}</span>
                              {fallbackUser?.id === user.id && (
                                <Badge 
                                  variant="secondary" 
                                  className="bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                                  data-testid={`badge-fallback-user-${user.id}`}
                                >
                                  <Shield className="w-3 h-3 mr-1" />
                                  Fallback
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Mail className="w-3 h-3 text-muted-foreground" />
                              {user.email}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getRoleColor(user.role)}>
                              {getRoleLabel(user.role)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditUser(user)}
                                data-testid={`button-edit-user-${user.id}`}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteUser(user)}
                                className="text-destructive hover:text-destructive"
                                data-testid={`button-delete-user-${user.id}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>

            {/* User Form */}
            {showUserForm && (
              <div className="w-80 flex-shrink-0">
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-medium mb-4">
                    {selectedUser ? "Edit User" : "Create New User"}
                  </h3>

                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="email" 
                                placeholder="user@example.com"
                                data-testid="input-user-email"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="John"
                                data-testid="input-user-first-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="Doe"
                                data-testid="input-user-last-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Role</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-user-role">
                                  <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="client_manager">Client Manager</SelectItem>
                                <SelectItem value="bookkeeper">Bookkeeper</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {selectedUser ? "New Password (optional)" : "Password"}
                            </FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="password" 
                                placeholder={selectedUser ? "Leave blank to keep current password" : "Enter password"}
                                data-testid="input-user-password"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {selectedUser ? "Confirm New Password" : "Confirm Password"}
                            </FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="password" 
                                placeholder="Confirm password"
                                data-testid="input-user-confirm-password"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex gap-2 pt-4">
                        <Button
                          type="submit"
                          className="flex-1"
                          disabled={createUserMutation.isPending || updateUserMutation.isPending}
                          data-testid="button-save-user"
                        >
                          {selectedUser ? "Update" : "Create"} User
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowUserForm(false);
                            setSelectedUser(null);
                          }}
                          data-testid="button-cancel-user"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </Form>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}