import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  Columns3, 
  List, 
  Folder, 
  Settings, 
  Upload, 
  Users, 
  LogOut,
  UserX
} from "lucide-react";
import ImpersonationPanel from "@/components/impersonation-panel";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";
import logoPath from "@assets/resized_logo_1758262615320.png";

interface SidebarProps {
  user: User;
}

export default function Sidebar({ user }: SidebarProps) {
  const [location] = useLocation();
  const { isImpersonating } = useAuth();

  const navigationItems = [
    {
      label: "Dashboard",
      href: "/",
      icon: Columns3,
      roles: ["admin", "manager", "client_manager", "bookkeeper"],
    },
    {
      label: "My Projects",
      href: "/projects",
      icon: Folder,
      roles: ["client_manager", "bookkeeper"],
    },
  ];

  const managementItems = [
    {
      label: "All Projects",
      href: "/all-projects",
      icon: Folder,
      roles: ["admin", "manager"],
    },
  ];

  const adminItems = [
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
      roles: ["admin"],
    },
    {
      label: "Upload Projects",
      href: "/upload",
      icon: Upload,
      roles: ["admin"],
    },
    {
      label: "User Management",
      href: "/users",
      icon: Users,
      roles: ["admin"],
    },
  ];

  const isActive = (href: string) => {
    if (href === "/") {
      return location === "/";
    }
    return location === href;
  };

  const canAccess = (roles: string[]) => {
    return user?.role ? roles.includes(user.role) : false;
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

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

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col h-full" data-testid="sidebar">
      {/* Logo and Brand */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <img 
            src={logoPath} 
            alt="Growth Accountants Logo" 
            className="h-8 w-auto"
            data-testid="img-sidebar-logo"
          />
          <div>
            <h1 className="text-lg font-semibold text-foreground" data-testid="text-app-name">The Link</h1>
            <p className="text-xs text-muted-foreground">Growth Accountants</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className={`p-4 border-b border-border ${isImpersonating ? 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800' : ''}`}>
        {isImpersonating && (
          <div className="mb-2">
            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" data-testid="impersonation-indicator">
              <UserX className="w-3 h-3 mr-1" />
              Testing Mode
            </Badge>
          </div>
        )}
        <div className="flex items-center space-x-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={user?.profileImageUrl || ""} alt={`${user?.firstName || ''} ${user?.lastName || ''}`} />
            <AvatarFallback className="bg-accent text-accent-foreground">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" data-testid="text-user-name">
              {user?.firstName && user?.lastName 
                ? `${user.firstName} ${user.lastName}` 
                : user?.email || 'Loading...'}
              {isImpersonating && (
                <span className="text-orange-600 dark:text-orange-400 ml-1 text-xs">(Testing)</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground" data-testid="text-user-role">
              {getRoleLabel()}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {/* Main Navigation */}
        {navigationItems.map((item) => {
          if (!canAccess(item.roles)) return null;
          
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive(item.href) ? "default" : "ghost"}
                className="w-full justify-start"
                data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <item.icon className="w-4 h-4 mr-3" />
                {item.label}
              </Button>
            </Link>
          );
        })}

        {/* Management Section */}
        {managementItems.some(item => canAccess(item.roles)) && (
          <>
            <Separator className="my-4" />
            <div className="py-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Management
              </p>
              {managementItems.map((item) => {
                if (!canAccess(item.roles)) return null;
                
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive(item.href) ? "default" : "ghost"}
                      className="w-full justify-start"
                      data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <item.icon className="w-4 h-4 mr-3" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {/* Admin Section */}
        {adminItems.some(item => canAccess(item.roles)) && (
          <>
            <Separator className="my-4" />
            <div className="py-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Administration
              </p>
              {adminItems.map((item) => {
                if (!canAccess(item.roles)) return null;
                
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive(item.href) ? "default" : "ghost"}
                      className="w-full justify-start"
                      data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <item.icon className="w-4 h-4 mr-3" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </nav>

      {/* Impersonation Panel (Admin Only) */}
      <ImpersonationPanel />

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-3" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
