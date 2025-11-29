import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { Users, Plus, Edit, Trash2, Mail, Calendar } from "lucide-react";
import type { User } from "@shared/schema";

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const createUserFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
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

export default function UserManagementModal({ isOpen, onClose }: UserManagementModalProps) {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isOpen,
  });

  const form = useForm<UserFormData>({
    resolver: zodResolver(selectedUser ? editUserFormSchema : createUserFormSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
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
        password: "",
        confirmPassword: "",
      });
    } else {
      form.reset({
        email: "",
        firstName: "",
        lastName: "",
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
      showFriendlyError({
        error,
        fallbackTitle: "Couldn't Create User",
        fallbackDescription: "Something went wrong while creating the user. Please check the details and try again."
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
      showFriendlyError({
        error,
        fallbackTitle: "Couldn't Update User",
        fallbackDescription: "Something went wrong while updating the user. Please check the details and try again."
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
      showFriendlyError({
        error,
        fallbackTitle: "Couldn't Delete User",
        fallbackDescription: "Something went wrong while deleting the user. The user may have associated data that needs to be removed first."
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


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            User Management
          </DialogTitle>
          <DialogDescription>
            Manage system users, roles, and permissions
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-6">
          {/* User List */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Users ({users?.length || 0})</h3>
              <Button
                onClick={handleNewUser}
                size="sm"
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
                      <TableHead>Created</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map((user: User) => (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell className="font-medium">
                          {user.firstName} {user.lastName}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="w-3 h-3 text-muted-foreground" />
                            {user.email}
                          </div>
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
      </DialogContent>
    </Dialog>
  );
}