import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function Profile() {
  const { user } = useAuth();

  const getUserInitials = () => {
    if (!user) return "U";
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || user.email?.charAt(0).toUpperCase() || "U";
  };

  const getRoleLabel = () => {
    if (!user?.role) return "Loading...";
    return user.role.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  if (!user) {
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
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8" data-testid="heading-user-profile">User Profile</h1>
        
        <Card>
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
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <p className="text-sm" data-testid="text-user-email">{user.email}</p>
              </div>
              
              <div className="pt-4 border-t border-border">
                <p className="text-muted-foreground text-center">
                  The full profile interface will be built next. This page currently serves as a placeholder for user profile management features.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}