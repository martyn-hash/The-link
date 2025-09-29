import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { List, UserX, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import SuperSearch from "@/components/super-search";
import AdminDropdown from "@/components/admin-dropdown";
import ImpersonationPanel from "@/components/impersonation-panel";
import type { User } from "@shared/schema";
import logoPath from "@assets/resized_logo_1758262615320.png";

interface TopNavigationProps {
  user?: User;
}

export default function TopNavigation({ user }: TopNavigationProps) {
  const [location] = useLocation();
  const { isImpersonating } = useAuth();

  const getUserInitials = () => {
    if (!user) return "U";
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || user.email?.charAt(0).toUpperCase() || "U";
  };

  const getUserDisplayName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user?.email || 'Loading...';
  };

  const isActive = (href: string) => {
    if (href === "/") {
      return location === "/";
    }
    return location === href;
  };

  const canAccess = (permissions: string[]) => {
    // Updated to use new boolean flags instead of role strings
    if (permissions.includes('admin') && user?.isAdmin) return true;
    if (permissions.includes('manager') && user?.canSeeAdminMenu) return true;
    return false;
  };

  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
  };

  return (
    <div className="bg-card border-b border-border">
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-orange-50 dark:bg-orange-950 border-b border-orange-200 dark:border-orange-800 px-6 py-2">
          <div className="flex items-center justify-center">
            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" data-testid="impersonation-indicator">
              <UserX className="w-3 h-3 mr-1" />
              Testing Mode Active
            </Badge>
          </div>
        </div>
      )}
      
      {/* Main Navigation */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left Section: Logo */}
          <div className="flex items-center space-x-6">
            <Link href="/">
              <div className="flex items-center space-x-3 cursor-pointer" data-testid="link-logo-home">
                <img 
                  src={logoPath} 
                  alt="Growth Accountants Logo" 
                  className="h-8 w-auto"
                  data-testid="img-navigation-logo"
                />
              </div>
            </Link>
          </div>

          {/* Center Section: Navigation Items */}
          <div className="flex items-center space-x-6">
            {/* User Info */}
            <Link href="/profile">
              <div 
                className="flex items-center space-x-3 hover:bg-accent/50 transition-colors cursor-pointer px-3 py-2 rounded-md" 
                data-testid="link-user-profile"
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user?.profileImageUrl || ""} alt={getUserDisplayName()} />
                  <AvatarFallback className="bg-accent text-accent-foreground text-sm">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium" data-testid="text-user-name">
                    {getUserDisplayName()}
                    {isImpersonating && (
                      <span className="text-orange-600 dark:text-orange-400 ml-1 text-xs">(Testing)</span>
                    )}
                  </span>
                </div>
              </div>
            </Link>

            {/* Global Super Search */}
            <SuperSearch 
              placeholder="Search clients, people, projects..." 
              className="w-80"
            />


            {/* Services */}
            {(user?.isAdmin || user?.canSeeAdminMenu) && (
              <Link href="/scheduled-services">
                <Button
                  variant={isActive("/scheduled-services") ? "default" : "ghost"}
                  className="flex items-center space-x-2"
                  data-testid="link-services"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Services</span>
                </Button>
              </Link>
            )}

            {/* Admin Dropdown */}
            <AdminDropdown user={user} />
          </div>

          {/* Right Section: Empty (Sign Out moved to profile page) */}
          <div></div>
        </div>
      </div>

      {/* Impersonation Panel (positioned below navigation) */}
      {isImpersonating && (
        <div className="px-6 pb-4">
          <ImpersonationPanel />
        </div>
      )}
    </div>
  );
}