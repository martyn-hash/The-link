import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserX, Users, LogOut } from "lucide-react";
import type { User } from "@shared/schema";

export default function ImpersonationPanel() {
  const { 
    user, 
    isImpersonating, 
    impersonationState, 
    startImpersonation, 
    stopImpersonation,
    isStartingImpersonation,
    isStoppingImpersonation 
  } = useAuth();
  
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Fetch all users for impersonation selection (admin only)
  const { data: allUsers, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: user?.role === 'admin' && !isImpersonating,
  });

  // Only show to admin users
  if (user?.role !== 'admin' && !isImpersonating) {
    return null;
  }

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

  const handleStartImpersonation = () => {
    if (selectedUserId) {
      startImpersonation(selectedUserId);
      setSelectedUserId("");
    }
  };

  const handleStopImpersonation = () => {
    stopImpersonation();
  };

  if (isImpersonating) {
    return (
      <Card className="mx-4 mb-4 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950" data-testid="impersonation-active-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center text-orange-800 dark:text-orange-200">
            <UserX className="w-4 h-4 mr-2" />
            Testing Mode Active
          </CardTitle>
          <CardDescription className="text-orange-700 dark:text-orange-300">
            You are testing as: <strong>{user?.firstName} {user?.lastName}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Avatar className="w-6 h-6">
                <AvatarImage src={user?.profileImageUrl || ""} />
                <AvatarFallback className="bg-orange-200 text-orange-800 text-xs">
                  {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <Badge className={getRoleColor(user?.role || "")} data-testid="impersonated-user-role">
                {getRoleLabel(user?.role || "")}
              </Badge>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleStopImpersonation}
              disabled={isStoppingImpersonation}
              data-testid="button-stop-impersonation"
              className="border-orange-300 text-orange-800 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-200 dark:hover:bg-orange-900"
            >
              <LogOut className="w-3 h-3 mr-1" />
              {isStoppingImpersonation ? "Stopping..." : "Exit Testing"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-4 mb-4" data-testid="impersonation-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center">
          <Users className="w-4 h-4 mr-2" />
          User Testing Panel
        </CardTitle>
        <CardDescription>
          Switch to any user account for testing purposes
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <Select 
          value={selectedUserId} 
          onValueChange={setSelectedUserId}
          disabled={usersLoading}
        >
          <SelectTrigger data-testid="select-user-impersonate">
            <SelectValue placeholder={usersLoading ? "Loading users..." : "Select user to test as"} />
          </SelectTrigger>
          <SelectContent>
            {allUsers?.filter(u => u.id !== user?.id).map((u) => (
              <SelectItem key={u.id} value={u.id} data-testid={`user-option-${u.id}`}>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">{u.firstName} {u.lastName}</span>
                  <Badge className={getRoleColor(u.role)} data-testid={`user-role-${u.id}`}>
                    {getRoleLabel(u.role)}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={handleStartImpersonation}
          disabled={!selectedUserId || isStartingImpersonation}
          className="w-full"
          data-testid="button-start-impersonation"
        >
          <UserX className="w-4 h-4 mr-2" />
          {isStartingImpersonation ? "Starting..." : "Start Testing as User"}
        </Button>
      </CardContent>
    </Card>
  );
}