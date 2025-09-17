import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import UserManagementModal from "@/components/user-management-modal";
import { useState } from "react";
import { Users } from "lucide-react";

export default function UserManagement() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [showUserModal, setShowUserModal] = useState(false);

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

  if (!isAuthenticated || user.role !== 'admin') {
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
      <Sidebar user={user} />
      
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

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  User Management Portal
                </CardTitle>
                <CardDescription>
                  Create, edit, and manage user accounts with comprehensive controls.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => setShowUserModal(true)}
                  size="lg"
                  data-testid="button-open-user-management"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Open User Management
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <UserManagementModal 
        isOpen={showUserModal} 
        onClose={() => setShowUserModal(false)} 
      />
    </div>
  );
}