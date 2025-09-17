import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { 
  BarChart3, 
  Columns3, 
  List, 
  Folder, 
  Settings, 
  Upload, 
  Users, 
  LogOut 
} from "lucide-react";
import type { User } from "@shared/schema";

interface SidebarProps {
  user: User;
}

export default function Sidebar({ user }: SidebarProps) {
  const [location] = useLocation();

  const navigationItems = [
    {
      label: "Dashboard",
      href: "/",
      icon: Columns3,
      roles: ["admin", "manager", "client_manager", "bookkeeper"],
    },
    {
      label: "Task List",
      href: "/tasks",
      icon: List,
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
    {
      label: "Team Overview",
      href: "/team",
      icon: Users,
      roles: ["admin", "manager"],
    },
  ];

  const adminItems = [
    {
      label: "Administration",
      href: "/admin",
      icon: Settings,
      roles: ["admin", "manager"],
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
      return location === "/" || location === "/dashboard";
    }
    return location === href;
  };

  const canAccess = (roles: string[]) => {
    return roles.includes(user.role);
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const getUserInitials = () => {
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || user.email?.charAt(0).toUpperCase() || "U";
  };

  const getRoleLabel = () => {
    return user.role.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col h-full" data-testid="sidebar">
      {/* Logo and Brand */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <BarChart3 className="text-primary-foreground text-sm" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground" data-testid="text-app-name">BookFlow</h1>
            <p className="text-xs text-muted-foreground">Project Management</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={user.profileImageUrl || ""} alt={`${user.firstName} ${user.lastName}`} />
            <AvatarFallback className="bg-accent text-accent-foreground">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" data-testid="text-user-name">
              {user.firstName && user.lastName 
                ? `${user.firstName} ${user.lastName}` 
                : user.email}
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
